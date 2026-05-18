export const getAgoraHTML = (config, callType, isCaller, isGroup, initialMemberMap = {}, myInfo = {}) => {
    const memberMapJson = JSON.stringify(initialMemberMap);
    const myInfoJson = JSON.stringify(myInfo);

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: transparent; font-family: -apple-system, sans-serif; overflow: hidden; height: 100vh; width: 100vw; }
      
      #main-grid {
        display: grid;
        width: 100%;
        height: 100%;
        gap: 2px;
        padding: 2px;
        background: transparent;
      }
      
      .video-tile {
        position: relative;
        background: transparent;
        overflow: hidden;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      body.single-mode .video-tile.remote { position: absolute; inset: 0; z-index: 1; }
      body.single-mode .video-tile.local {
        position: absolute;
        top: 50px;
        right: 20px;
        width: 110px;
        height: 150px;
        border-radius: 16px;
        z-index: 10;
        border: 2px solid rgba(255,255,255,0.3);
        box-shadow: 0 12px 32px rgba(0,0,0,0.6);
        transform-origin: center center;
        will-change: transform, top, right, width, height, border-radius, box-shadow;
        transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        touch-action: none;
        user-select: none;
      }

      body.single-mode .video-tile.local.dragging {
        z-index: 999;
        border-color: rgba(99, 102, 241, 0.8);
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8);
        transition: none !important;
      }

      body.single-mode .video-tile.local.returning {
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.3s ease, box-shadow 0.3s ease !important;
      }

      /* Full-screen local video background when remote has no video */
      body.single-mode:not(.has-remote-video) .video-tile.local {
        position: absolute;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        top: 0 !important;
        right: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        box-shadow: none !important;
        z-index: 1 !important;
        transform: none !important;
      }
      
      body.single-mode:not(.has-remote-video) .video-tile.local .member-label {
        display: none !important;
      }
      
      body.single-mode:not(.has-remote-video) .video-tile.remote {
        display: none !important;
      }


      .video-view { width: 100%; height: 100%; z-index: 2; position: relative; display: none; }
      .video-view video { object-fit: cover !important; }

      .avatar-placeholder {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        z-index: 1;
      }
      body.single-mode .avatar-placeholder { display: none !important; }


      .avatar-circle {
        width: 80px;
        height: 80px;
        border-radius: 40px;
        background: #6366f1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 32px;
        font-weight: bold;
        border: 4px solid rgba(255,255,255,0.1);
        background-size: cover;
        background-position: center;
        margin-bottom: 12px;
      }

      body.single-mode .local .avatar-circle {
        width: 50px;
        height: 50px;
        font-size: 20px;
      }

      .member-label {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(8px);
        color: #fff;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        z-index: 5;
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      #unlock-layer { position: fixed; inset: 0; background: rgba(0,0,0,0.8); color: white; display: none; align-items: center; justify-content: center; z-index: 1000; }
    </style>
  </head>
  <body class="${isGroup ? 'group-mode' : 'single-mode'}">
    <div id="unlock-layer">Chạm để bật âm thanh</div>
    <div id="main-grid">
        <div id="local-container" class="video-tile local">
            <div id="local-placeholder" class="avatar-placeholder">
                <div class="avatar-circle" id="local-avatar"></div>
            </div>
            <div id="local-player" class="video-view"></div>
            <div class="member-label">Bạn (You)</div>
        </div>
    </div>

    <script>
      let memberMap = ${memberMapJson};
      let myInfo = ${myInfoJson};
      let client = null;
      let localTracks = { videoTrack: null, audioTrack: null };
      const numericUid = Number("${config.uid}");

      function log(msg) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
      }

      function getInitial(name) {
        return (name || 'U').charAt(0).toUpperCase();
      }

      function setAvatar(el, info) {
        if (!el) return;
        if (info && info.avatar) {
          el.style.backgroundImage = 'url(' + info.avatar + ')';
          el.innerText = '';
        } else {
          el.style.backgroundImage = 'none';
          el.innerText = getInitial(info ? info.name : 'U');
        }
      }

      // Khởi tạo avatar cho local
      setAvatar(document.getElementById('local-avatar'), myInfo);

      function updateGridLayout() {
        const grid = document.getElementById('main-grid');
        const tiles = Array.from(grid.children).filter(el => el.id !== 'unlock-layer');
        const count = tiles.length;

        if ("${isGroup}" === "true") {
          if (count <= 1) {
            grid.style.gridTemplateColumns = '1fr';
            grid.style.gridTemplateRows = '1fr';
          } else if (count === 2) {
            grid.style.gridTemplateColumns = '1fr';
            grid.style.gridTemplateRows = '1fr 1fr';
          } else if (count <= 4) {
            grid.style.gridTemplateColumns = '1fr 1fr';
            grid.style.gridTemplateRows = '1fr 1fr';
          } else {
            grid.style.gridTemplateColumns = '1fr 1fr';
            grid.style.gridAutoRows = '1fr';
          }

          const local = document.getElementById('local-container');
          if (count >= 2 && tiles[0] !== local && tiles[1] !== local) {
             grid.insertBefore(local, tiles[1]);
          }
        }
      }

      function getOrCreateTile(uid) {
        let tile = document.getElementById(uid.toString());
        if (!tile) {
            tile = document.createElement('div');
            tile.id = uid.toString();
            tile.className = 'video-tile remote';
            
            const info = memberMap[uid.toString()] || { name: 'Thành viên ' + uid };
            
            const placeholder = document.createElement('div');
            placeholder.className = 'avatar-placeholder';
            const avatar = document.createElement('div');
            avatar.className = 'avatar-circle';
            setAvatar(avatar, info);
            placeholder.appendChild(avatar);
            tile.appendChild(placeholder);

            const player = document.createElement('div');
            player.className = 'video-view';
            tile.appendChild(player);
            
            const label = document.createElement('div');
            label.className = 'member-label';
            label.innerText = info.name;
            tile.appendChild(label);
            
            document.getElementById('main-grid').appendChild(tile);
            updateGridLayout();
        }
        return tile;
      }

      window.handleAction = async (action) => {
        if (action.type === 'join') doJoin();
        if (action.type === 'toggle-mic' && localTracks.audioTrack) {
          await localTracks.audioTrack.setEnabled(action.enabled);
        }
        if (action.type === 'toggle-cam') {
          try {
            if (action.enabled) {
              if (!localTracks.videoTrack) {
                localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMin: 500, bitrateMax: 2000 }
                });
                await client.publish(localTracks.videoTrack);
                localTracks.videoTrack.play('local-player', { fit: 'contain' });
              } else {
                await localTracks.videoTrack.setEnabled(true);
              }
              document.getElementById('local-player').style.display = 'block';
              document.getElementById('local-container').style.display = 'flex';
            } else {
              if (localTracks.videoTrack) await localTracks.videoTrack.setEnabled(false);
              document.getElementById('local-player').style.display = 'none';
              // 1-1 thì ẩn hẳn khung PIP, Group thì để lại hiện avatar
              if ("${isGroup}" !== "true") {
                document.getElementById('local-container').style.display = 'none';
              }
            }
          } catch (e) { log("Cam error: " + e.message); }
        }


        if (action.type === 'leave') {
          try {
            if (client) {
              await client.leave();
              log("Agora client left channel");
            }
            if (localTracks.videoTrack) { localTracks.videoTrack.stop(); localTracks.videoTrack.close(); localTracks.videoTrack = null; }
            if (localTracks.audioTrack) { localTracks.audioTrack.stop(); localTracks.audioTrack.close(); localTracks.audioTrack = null; }
          } catch (e) { log("Leave error: " + e.message); }
        }


        if (action.type === 'update-members') {

          memberMap = action.members;
          Object.keys(memberMap).forEach(uid => {
            const tile = document.getElementById(uid);
            if (tile) {
                const info = memberMap[uid];
                tile.querySelector('.member-label').innerText = info.name;
                setAvatar(tile.querySelector('.avatar-circle'), info);
            }
          });
        }
      };

      async function doJoin() {

        if (window.isAgoraStarted) return;
        window.isAgoraStarted = true;
        
        try {
          client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
          window.agoraClient = client; // Export để RN poll được
          let token = "${config.token}";
          if (token === "null" || token === "undefined" || !token || token === "") {
              token = null;
          }

          const localBox = document.getElementById('local-player');

          if ("${callType}" === "video") {
            document.getElementById('local-player').style.display = 'block';
          }

          client.on("user-joined", (user) => {
                log("User joined channel: " + user.uid);
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'user-joined', 
                    uid: user.uid 
                }));
          });

          client.on("user-published", async (user, mediaType) => {
                log("User published media: " + user.uid + " (" + mediaType + ")");
                try {
                    await client.subscribe(user, mediaType);
                    log("Subscribed to: " + user.uid + " " + mediaType);
                    
                    const tile = getOrCreateTile(user.uid);
                    if (mediaType === "video") {
                        const tile = getOrCreateTile(user.uid);
                        const player = tile.querySelector('.video-view');
                        if (player) {
                          player.style.display = 'block';
                          const playTrack = () => {
                            if (user.videoTrack) {
                              user.videoTrack.play(player, { fit: 'contain' });
                            }
                          };
                          playTrack();
                          setTimeout(playTrack, 100);
                          setTimeout(playTrack, 500);
                        }
                        document.body.classList.add('has-remote-video');
                        log("Playing remote video for: " + user.uid);
                    }
                    if (mediaType === "audio" && user.audioTrack) {
                        try {
                            user.audioTrack.setVolume(150);
                        } catch (e) {
                            log("Failed to set audio volume: " + e.message);
                        }
                        user.audioTrack.play().catch(err => {
                            log("Audio play error: " + err.message);
                            if (err.code === 'AUTOPLAY_NOT_ALLOWED') {
                                document.getElementById('unlock-layer').style.display = 'flex';
                            }
                        });
                    }

                    window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        type: 'user-published', 
                        uid: user.uid, 
                        mediaType: mediaType 
                    }));
                } catch (err) {
                    log("Subscribe error: " + err.message);
                }
          });

          client.on("user-unpublished", (user, mediaType) => {
                log("User unpublished: " + user.uid + " (" + mediaType + ")");
                if (mediaType === "video") {
                  document.body.classList.remove('has-remote-video');
                  const tile = document.getElementById(user.uid.toString());
                  if (tile) {
                    const player = tile.querySelector('.video-view');
                    if (player) player.style.display = 'none';
                  }
                  window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'user-unpublished', 
                    uid: user.uid, 
                    mediaType: 'video' 
                  }));
                }
          });

          client.on("user-left", (user) => {
                log("User left channel: " + user.uid);
                const el = document.getElementById(user.uid.toString());
                if (el) el.remove();
                updateGridLayout();
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'user-left', 
                    uid: user.uid 
                }));
          });

          log("Joining channel: " + "${config.channel}" + " as " + numericUid);
          await client.join("${config.appId}", "${config.channel}", token, numericUid);
          log("Join success. Remote users existing: " + client.remoteUsers.length);
          
          // Kiểm tra những người đã ở sẵn trong phòng
          client.remoteUsers.forEach(user => {
              log("Existing user found: " + user.uid);
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'user-joined', 
                  uid: user.uid 
              }));
              // Nếu họ đã publish thì Agora sẽ tự bắn user-published sau đó
          });

          let tracksToPublish = [];

          try {
            localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                AEC: true,
                AGC: true,
                ANS: true,
                encoderConfig: 'speech_standard'
            });
            tracksToPublish.push(localTracks.audioTrack);
            log("Local audio track created");
          } catch (audioError) {
            log("Failed to create local audio track: " + audioError.message);
          }

          if ("${callType}" === "video") {
            try {
              localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
                  encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMin: 500, bitrateMax: 2000 }
              });
              localTracks.videoTrack.play(localBox, { fit: 'contain' });
              tracksToPublish.push(localTracks.videoTrack);
              log("Local video track created");
            } catch (videoError) {
              log("Failed to create local video track: " + videoError.message);
              if ("${isGroup}" !== "true") {
                document.getElementById('local-container').style.display = 'none';
              }
            }
          }

          if (tracksToPublish.length > 0) {
            try {
              await client.publish(tracksToPublish);
              log("Successfully published " + tracksToPublish.length + " local tracks together");
            } catch (pubError) {
              log("Failed to publish local tracks: " + pubError.message);
            }
          }
          
          updateGridLayout();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'joined' }));

          // Heartbeat để đồng bộ số lượng người và trạng thái Video
          setInterval(() => {
            if (window.agoraClient) {
              const remoteUsers = window.agoraClient.remoteUsers;
              const videoUids = remoteUsers.filter(u => u.hasVideo).map(u => u.uid);
              const uids = remoteUsers.map(u => u.uid);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'sync', 
                count: remoteUsers.length,
                videoUids: videoUids,
                uids: uids
              }));
            }
          }, 2000);

        } catch (e) { log("Join error: " + e.message); }
      }



      function unlockAudio() {
        if (client) {
            client.remoteUsers.forEach(user => {
                if (user.audioTrack) user.audioTrack.play().catch(() => {});
            });
        }
        document.getElementById('unlock-layer').style.display = 'none';
      }
      document.getElementById('unlock-layer').onclick = unlockAudio;

      // Premium Draggable & Zoomable PIP Box for 1-1 Single Mode
      if ("${isGroup}" !== "true") {
        (function() {
          const localBox = document.getElementById('local-container');
          let isDragging = false;
          let startX, startY;
          let currentX = 0, currentY = 0;

          localBox.addEventListener('touchstart', (e) => {
            if (!document.body.classList.contains('has-remote-video')) return;

            isDragging = true;
            localBox.classList.add('dragging');
            localBox.classList.remove('returning');
            
            const touch = e.touches[0];
            startX = touch.clientX - currentX;
            startY = touch.clientY - currentY;
            
            localBox.style.transform = 'translate(' + currentX + 'px, ' + currentY + 'px) scale(1.3)';
          }, { passive: false });

          localBox.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault(); // Ngăn cuộn trang webview khi kéo thả
            
            const touch = e.touches[0];
            currentX = touch.clientX - startX;
            currentY = touch.clientY - startY;
            
            localBox.style.transform = 'translate(' + currentX + 'px, ' + currentY + 'px) scale(1.3)';
          }, { passive: false });

          const releasePIP = () => {
            if (!isDragging) return;
            isDragging = false;
            
            localBox.classList.remove('dragging');
            localBox.classList.add('returning');
            
            currentX = 0;
            currentY = 0;
            
            localBox.style.transform = 'translate(0px, 0px) scale(1)';
            
            setTimeout(() => {
              localBox.classList.remove('returning');
            }, 400);
          };

          localBox.addEventListener('touchend', releasePIP);
          localBox.addEventListener('touchcancel', releasePIP);
        })();
      }

      setTimeout(() => {
        log("Triggering auto-join...");
        window.handleAction({ type: 'join' });
      }, 200);
    </script>
  </body>
</html>
    `;
};



