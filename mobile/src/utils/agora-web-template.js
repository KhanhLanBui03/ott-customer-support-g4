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
      body { background: #000; font-family: -apple-system, sans-serif; overflow: hidden; height: 100vh; width: 100vw; }
      
      #main-grid {
        display: grid;
        width: 100%;
        height: 100%;
        gap: 2px;
        padding: 2px;
        background: #000;
      }
      
      .video-tile {
        position: relative;
        background: #0f172a;
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
        top: 30px;
        right: 20px;
        width: 110px;
        height: 150px;
        border-radius: 16px;
        z-index: 10;
        border: 2px solid rgba(255,255,255,0.3);
        box-shadow: 0 12px 32px rgba(0,0,0,0.6);
        transition: all 0.4s ease;
      }

      /* Khi chưa có video đối phương, cho mình lên toàn màn hình */
      body.single-mode:not(.has-remote-video) .video-tile.local {
        top: 0;
        right: 0;
        width: 100vw;
        height: 100vh;
        border-radius: 0;
        border: none;
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
                localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
                await client.publish(localTracks.videoTrack);
                localTracks.videoTrack.play('local-player');
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
          const token = "${config.token}" === "null" ? null : "${config.token}";

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
                          user.videoTrack.play(player);
                        }
                        document.body.classList.add('has-remote-video');
                        log("Playing remote video for: " + user.uid);
                    }
                    if (mediaType === "audio") {
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

          localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          await client.publish(localTracks.audioTrack);
          log("Local audio published");

          if ("${callType}" === "video") {
            localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
            localTracks.videoTrack.play(localBox);
            await client.publish(localTracks.videoTrack);
            log("Local video published");
          }
          
          updateGridLayout();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'joined' }));

          // Heartbeat để đồng bộ số lượng người và trạng thái Video
          setInterval(() => {
            if (window.agoraClient) {
              const remoteUsers = window.agoraClient.remoteUsers;
              const videoUids = remoteUsers.filter(u => u.hasVideo).map(u => u.uid);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'sync', 
                count: remoteUsers.length,
                videoUids: videoUids
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

      setTimeout(() => {
        log("Triggering auto-join...");
        window.handleAction({ type: 'join' });
      }, 200);
    </script>
  </body>
</html>
    `;
};



