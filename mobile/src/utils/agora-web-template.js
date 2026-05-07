export const getAgoraHTML = (config, callType) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js"></script>
    <style>
      body { margin: 0; padding: 0; background: #0f172a; overflow: hidden; width: 100vw; height: 100vh; }
      #remote-container { position: absolute; width: 100%; height: 100%; top: 0; left: 0; }
      #local-container { position: absolute; width: 110px; height: 160px; bottom: 250px; right: 20px; border-radius: 20px; overflow: hidden; z-index: 10; border: 2px solid #6366f1; background: #1e293b; box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
      .video-view { width: 100%; height: 100%; background: #000; object-fit: cover; border-radius: inherit; }
      /* Gradient overlays for controls readability */
      .overlay-gradient-top { position: absolute; top: 0; left: 0; right: 0; height: 150px; background: linear-gradient(to bottom, rgba(15,23,42,0.8) 0%, transparent 100%); z-index: 5; pointer-events: none; }
      .overlay-gradient-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 250px; background: linear-gradient(to top, rgba(15,23,42,0.9) 0%, transparent 100%); z-index: 5; pointer-events: none; }
      /* Lớp phủ để bắt sự kiện chạm mở khóa âm thanh */
      #unlock-layer { position: absolute; width: 100%; height: 100%; z-index: 99; }
    </style>
  </head>
  <body>
    <div id="unlock-layer"></div>
    <div class="overlay-gradient-top"></div>
    <div class="overlay-gradient-bottom"></div>
    <div id="remote-container"></div>
    <div id="local-container"></div>
    <script>
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      let localTracks = { videoTrack: null, audioTrack: null };
      
      function log(msg) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
      }

      // Lắng nghe lệnh từ React Native
      window.handleAction = async (action) => {
        log("Received action: " + action.type + " enabled: " + action.enabled);
        if (action.type === 'toggle-mic') {
          if (localTracks.audioTrack) {
            await localTracks.audioTrack.setEnabled(action.enabled);
          }
        } else if (action.type === 'toggle-cam') {
          if (localTracks.videoTrack) {
            await localTracks.videoTrack.setEnabled(action.enabled);
          }
        }
      };

      // Mở khóa âm thanh khi người dùng chạm vào màn hình
      // Mở khóa âm thanh khi người dùng chạm vào màn hình
      document.getElementById('unlock-layer').onclick = async () => {
        log("User clicked to unlock audio");
        try {
          // Kích hoạt AudioContext
          if (AgoraRTC.getAudioContext()) {
            await AgoraRTC.getAudioContext().resume();
          }
          // Resume lại âm thanh cho tất cả remote users đã có
          client.remoteUsers.forEach(user => {
            if (user.audioTrack) {
              user.audioTrack.play();
              log("Playing audio for: " + user.uid);
            }
          });
        } catch (e) {
          log("Unlock error: " + e.message);
        }
        document.getElementById('unlock-layer').remove();
      };

      async function start() {
        try {
          const token = "${config.token}" === "null" ? null : "${config.token}";
          
          // Đăng ký listener TRƯỚC KHI join
          client.on("user-published", async (user, mediaType) => {
            log("Remote user published: " + user.uid + " " + mediaType);
            await client.subscribe(user, mediaType);
            log("Subscribed to " + user.uid);
            
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'user-joined', uid: user.uid }));

            if (mediaType === "video") {
              const remotePlayerContainer = document.createElement("div");
              remotePlayerContainer.id = user.uid.toString();
              remotePlayerContainer.className = "video-view";
              document.getElementById("remote-container").append(remotePlayerContainer);
              user.videoTrack.play(remotePlayerContainer);
            }
            if (mediaType === "audio") {
              user.audioTrack.play();
              log("Audio playing for " + user.uid);
            }
          });

          client.on("user-left", (user) => {
            log("User left: " + user.uid);
            const player = document.getElementById(user.uid.toString());
            if (player) player.remove();
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'user-left', uid: user.uid }));
          });

          log("Joining channel: ${config.channel}");
          await client.join("${config.appId}", "${config.channel}", token, null);
          log("Joined successfully as " + client.uid);
          
          if ("${callType}" === 'video') {
            localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
            localTracks.videoTrack.play("local-container");
          }
          localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          log("Mic track created. Muted: " + localTracks.audioTrack.muted);
          
          // Kiểm tra âm lượng mỗi giây
          setInterval(() => {
            if (localTracks.audioTrack) {
              const level = localTracks.audioTrack.getVolumeLevel();
              if (level > 0.01) {
                log("Mic volume detected: " + level.toFixed(2));
              }
            }
          }, 1000);

          await client.publish(Object.values(localTracks).filter(t => t !== null));
          log("Local tracks published");

        } catch (e) {
          log("Agora error: " + e.message);
        }
      }
      start();
    </script>
  </body>
  </html>
  `;
};
