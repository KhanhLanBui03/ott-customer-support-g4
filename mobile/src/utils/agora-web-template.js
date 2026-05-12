export const getAgoraHTML = (config, callType, isCaller = false) => {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js"></script>
    <style>
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #111827; overflow: hidden; font-family: -apple-system, sans-serif; }
      #remote-container { position: absolute; width: 100%; height: 100%; top: 0; left: 0; z-index: 1; background: #000; }
      .video-view { width: 100%; height: 100%; background: #000; object-fit: cover; }
      #local-container { 
        position: absolute; width: 110px; height: 150px; 
        top: 80px; right: 20px; /* Chuyển lên trên bên phải */
        z-index: 10; border-radius: 12px; overflow: hidden; border: 2px solid rgba(255,255,255,0.4);
        box-shadow: 0 8px 24px rgba(0,0,0,0.5); background: #222;
        touch-action: none; /* Quan trọng để kéo thả mượt mà */
      }
      #unlock-layer { 
        position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
        z-index: 9999; background: transparent;
      }
    </style>
  </head>
  <body>
    <div id="unlock-layer"></div>
    <div id="remote-container"></div>
    <div id="local-container"></div>
    
    <script>
      const log = (msg) => {
        console.log("[WebView-Agora] " + msg);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
      };

      let client = null;
      let localTracks = { videoTrack: null, audioTrack: null };
      let isJoined = false;

      // Logic kéo thả khung Local Video
      const localBox = document.getElementById('local-container');
      let isDragging = false;
      let offset = { x: 0, y: 0 };

      localBox.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        offset.x = touch.clientX - localBox.offsetLeft;
        offset.y = touch.clientY - localBox.offsetTop;
        localBox.style.borderColor = "#6366f1"; // Đổi màu viền khi đang kéo
      });

      document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        let x = touch.clientX - offset.x;
        let y = touch.clientY - offset.y;
        
        // Giới hạn không cho kéo ra ngoài màn hình
        const maxX = window.innerWidth - localBox.offsetWidth - 10;
        const maxY = window.innerHeight - localBox.offsetHeight - 10;
        x = Math.max(10, Math.min(x, maxX));
        y = Math.max(10, Math.min(y, maxY));

        localBox.style.left = x + 'px';
        localBox.style.top = y + 'px';
        localBox.style.right = 'auto'; // Hủy bỏ thuộc tính right: 20px ban đầu
        localBox.style.bottom = 'auto';
      });

      document.addEventListener('touchend', () => {
        isDragging = false;
        localBox.style.borderColor = "rgba(255,255,255,0.4)";
      });

      function toNumericUid(userId, isCaller) {
        let baseUid = 0;
        if (typeof userId === 'number') baseUid = userId;
        else if (userId && /^\\d+$/.test(String(userId))) baseUid = parseInt(String(userId), 10);
        else if (userId) {
            let hash = 0;
            const s = String(userId);
            for (let i = 0; i < s.length; i++) {
                hash = ((hash << 5) - hash) + s.charCodeAt(i);
                hash = hash & hash;
            }
            baseUid = Math.abs(hash) % 1000000;
        }
        return (isCaller ? 1000000 : 2000000) + (baseUid % 1000000);
      }

      function unlockAudio() {
        try {
            const silent = document.getElementById('silent-audio');
            if (silent) silent.play().catch(() => {});
            if (client) {
                client.remoteUsers.forEach(user => {
                    if (user.audioTrack) user.audioTrack.play().catch(() => {});
                });
            }
            document.getElementById('unlock-layer').style.display = 'none';
        } catch (e) { log("Unlock error: " + e.message); }
      }

      window.handleAction = async (action) => {
        try {
          if (action.type === 'toggle-mic') {
            if (localTracks.audioTrack) await localTracks.audioTrack.setEnabled(action.enabled);
          } else if (action.type === 'toggle-cam') {
            if (localTracks.videoTrack) {
              await localTracks.videoTrack.setEnabled(action.enabled);
              localBox.style.display = action.enabled ? 'block' : 'none';
            } else if (action.enabled && isJoined) {
              localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
              localTracks.videoTrack.play("local-container");
              await client.publish(localTracks.videoTrack);
              localBox.style.display = 'block';
            }
          }
        } catch (err) { log("Action error: " + err.message); }
      };

      document.getElementById('unlock-layer').onclick = unlockAudio;
      document.getElementById('unlock-layer').ontouchstart = unlockAudio;

      async function start() {
        if (window.isAgoraStarted) return;
        window.isAgoraStarted = true;
        try {
          client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
          const token = "${config.token}" === "null" ? null : "${config.token}";
          const isCallerFlag = ${isCaller};
          const numericUid = toNumericUid("${config.uid}", isCallerFlag);
          
          client.on("user-published", async (user, mediaType) => {
                await client.subscribe(user, mediaType);
                if (mediaType === "video") {
                  let container = document.getElementById(user.uid.toString());
                  if (!container) {
                    container = document.createElement("div");
                    container.id = user.uid.toString();
                    container.className = "video-view";
                    document.getElementById("remote-container").append(container);
                  }
                  user.videoTrack.play(container);
                }
                if (mediaType === "audio") user.audioTrack.play().catch(() => {});
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'user-published', uid: user.uid, mediaType: mediaType }));
          });

          client.on("user-left", (user) => {
                const el = document.getElementById(user.uid.toString());
                if (el) el.remove();
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'user-left', uid: user.uid }));
          });

          log("Joining: " + "${config.channel}" + " as " + numericUid);
          await client.join("${config.appId}", "${config.channel}", token, numericUid);
          isJoined = true;
          
          await new Promise(r => setTimeout(r, 500));
          localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          if ("${callType}" === 'video') {
              localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
              localTracks.videoTrack.play("local-container");
              localBox.style.display = 'block';
          }
          if (isJoined) {
              const tracks = Object.values(localTracks).filter(t => t !== null);
              if (tracks.length > 0) await client.publish(tracks);
          }
        } catch (e) { log("Join Error: " + e.message); }
      }
      start();
    </script>
    <audio id="silent-audio" loop><source src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=" type="audio/wav"></audio>
  </body>
</html>
    `;
};
