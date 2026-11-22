export const getAgoraHTML = (config, callType, isCaller, isGroup, initialMemberMap = {}, myInfo = {}, i18n = {}, nativePerms = { mic: true, cam: true }) => {
    const memberMapJson = JSON.stringify(initialMemberMap);
    const myInfoJson = JSON.stringify(myInfo);
    const initialCanMic = nativePerms?.mic !== false;
    const initialCanCam = nativePerms?.cam !== false;

    const labels = {
        you: i18n.you || 'Bạn',
        tapToAudio: i18n.tapToAudio || 'Chạm để bật âm thanh cuộc gọi',
        memberPrefix: i18n.memberPrefix || 'Thành viên'
    };

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.22.2.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body {
        background: #090d16;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        overflow: hidden;
        height: 100%;
        width: 100%;
        position: fixed;
        inset: 0;
      }

      #main-grid {
        display: grid;
        width: 100%;
        height: 100%;
        gap: 6px;
        padding: 6px;
        background: #090d16;
      }

      body.single-mode #main-grid {
        display: block;
        padding: 0;
        gap: 0;
      }

      .video-tile {
        position: relative;
        background: #111827;
        overflow: hidden;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      body.group-mode .video-tile {
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      body.single-mode .video-tile.remote {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      body.single-mode .video-tile.local {
        position: fixed;
        top: calc(env(safe-area-inset-top, 44px) + 68px);
        right: 16px;
        width: 108px;
        height: 152px;
        border-radius: 18px;
        z-index: 10;
        border: 2px solid rgba(255, 255, 255, 0.28);
        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55);
        transform-origin: center center;
        will-change: transform;
        transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.25s ease;
        touch-action: none;
        user-select: none;
        background: #111827;
      }

      body.single-mode .video-tile.local.dragging {
        z-index: 999;
        border-color: rgba(99, 102, 241, 0.9);
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.75);
        transition: none !important;
      }

      body.single-mode:not(.has-remote-video) .video-tile.local {
        position: fixed;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
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

      .video-view {
        width: 100%;
        height: 100%;
        z-index: 2;
        position: relative;
        display: none;
        overflow: hidden;
      }
      .video-view > div {
        width: 100% !important;
        height: 100% !important;
        background: transparent !important;
      }
      .video-view video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        display: block !important;
      }
      #local-player.mirror-front video {
        transform: scaleX(-1);
        -webkit-transform: scaleX(-1);
      }

      .avatar-placeholder {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 50% 35%, #1e293b 0%, #090d16 100%);
        z-index: 1;
      }
      body.single-mode .avatar-placeholder { display: none !important; }

      .avatar-circle {
        width: 76px;
        height: 76px;
        border-radius: 38px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 30px;
        font-weight: 700;
        border: 3px solid rgba(255, 255, 255, 0.16);
        background-size: cover;
        background-position: center;
        margin-bottom: 10px;
      }

      body.single-mode .local .avatar-circle {
        width: 48px;
        height: 48px;
        font-size: 18px;
      }

      .member-label {
        position: absolute;
        bottom: 10px;
        left: 10px;
        max-width: calc(100% - 20px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: rgba(9, 13, 22, 0.65);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: #f8fafc;
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        z-index: 5;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }

      #unlock-layer {
        position: fixed;
        inset: 0;
        background: rgba(9, 13, 22, 0.78);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        color: #ffffff;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        z-index: 1000;
        text-align: center;
        padding: 24px;
      }
      #unlock-btn {
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: #ffffff;
        border: none;
        padding: 14px 28px;
        border-radius: 999px;
        font-size: 15px;
        font-weight: 700;
        box-shadow: 0 10px 28px rgba(99, 102, 241, 0.45);
      }
    </style>
  </head>
  <body class="${isGroup ? 'group-mode' : 'single-mode'}">
    <div id="unlock-layer">
      <button id="unlock-btn" type="button">${labels.tapToAudio}</button>
    </div>
    <div id="main-grid">
      <div id="local-container" class="video-tile local">
        <div id="local-placeholder" class="avatar-placeholder">
          <div class="avatar-circle" id="local-avatar"></div>
        </div>
        <div id="local-player" class="video-view"></div>
        <div class="member-label">${labels.you}</div>
      </div>
    </div>

    <script>
      let memberMap = ${memberMapJson};
      let myInfo = ${myInfoJson};
      let client = null;
      let localTracks = { videoTrack: null, audioTrack: null };
      let desiredMicEnabled = true;
      let desiredCamEnabled = "${callType}" === "video";
      let canUseMic = ${initialCanMic};
      let canUseCam = ${initialCanCam};
      let isAcquiringAudio = false;
      let isAcquiringVideo = false;
      let isInitializingTracks = false;
      let publishedAudio = false;
      let publishedVideo = false;
      let currentFacingMode = 'user';
      let isJoiningOrJoined = false;
      let heartbeatTimer = null;
      const numericUid = Number("${config.uid}");
      const subscribedKeys = new Set();

      function postToRN(payload) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (e) {}
      }

      function log(msg) {
        postToRN({ type: 'log', message: String(msg) });
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

      setAvatar(document.getElementById('local-avatar'), myInfo);
      if ("${callType}" !== "video" && "${isGroup}" !== "true") {
        document.getElementById('local-container').style.display = 'none';
      }

      function resumeWebAudioContexts() {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
            }
            setTimeout(() => { try { ctx.close(); } catch (e) {} }, 250);
          }
        } catch (e) {}
      }

      function replayAllRemoteAudio() {
        if (!client) return;
        client.remoteUsers.forEach((user) => {
          if (user.audioTrack) {
            try {
              user.audioTrack.setVolume(100);
              user.audioTrack.play();
            } catch (e) {
              log("replayRemoteAudio err (" + user.uid + "): " + e.message);
            }
          }
        });
      }

      function showUnlockLayer() {
        const el = document.getElementById('unlock-layer');
        if (el) el.style.display = 'flex';
        postToRN({ type: 'autoplay-failed' });
      }

      function unlockAudio() {
        resumeWebAudioContexts();
        replayAllRemoteAudio();
        const el = document.getElementById('unlock-layer');
        if (el) el.style.display = 'none';
        postToRN({ type: 'audio-unlocked' });
      }

      if (typeof AgoraRTC !== 'undefined') {
        AgoraRTC.onAutoplayFailed = function () {
          log("AgoraRTC.onAutoplayFailed triggered");
          showUnlockLayer();
        };
      }

      document.getElementById('unlock-layer').addEventListener('click', unlockAudio);
      document.getElementById('unlock-btn').addEventListener('click', unlockAudio);
      document.addEventListener('touchstart', () => {
        if (client && client.remoteUsers && client.remoteUsers.length > 0) {
          replayAllRemoteAudio();
        }
      }, { passive: true });

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

          const info = memberMap[uid.toString()] || { name: '${labels.memberPrefix} ' + uid };

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

      async function acquireMicrophoneTrack() {
        log("Checking mediaDevices: " + (!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) + " | secureContext: " + window.isSecureContext);
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const perm = await navigator.permissions.query({ name: 'microphone' });
            log("WebView microphone permission state: " + perm.state);
          }
        } catch (e) {}

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await withTimeout(
              navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
              }),
              5000,
              'getUserMedia(audio+AEC)'
            );
            const rawTrack = stream.getAudioTracks()[0];
            if (rawTrack) {
              log("Acquired raw mic track via getUserMedia(AEC): " + rawTrack.label);
              return AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: rawTrack });
            }
          } catch (err1) {
            log("getUserMedia(audio+AEC) failed: " + (err1 && err1.name ? err1.name + ': ' : '') + (err1 && err1.message ? err1.message : err1));
          }

          try {
            const streamBasic = await withTimeout(
              navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
              5000,
              'getUserMedia(audio basic)'
            );
            const rawTrackBasic = streamBasic.getAudioTracks()[0];
            if (rawTrackBasic) {
              log("Acquired raw mic track via getUserMedia(basic): " + rawTrackBasic.label);
              return AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: rawTrackBasic });
            }
          } catch (err2) {
            log("getUserMedia(audio basic) failed: " + (err2 && err2.name ? err2.name + ': ' : '') + (err2 && err2.message ? err2.message : err2));
          }
        }

        return await withTimeout(
          AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            AGC: true,
            ANS: true,
            encoderConfig: 'speech_standard'
          }),
          8000,
          'createMicrophoneAudioTrack'
        );
      }

      function renderVideoTrackToContainer(track, container, isLocal) {
        if (!track || !container) return;
        container.style.display = 'block';
        if (isLocal) {
          container.classList.toggle('mirror-front', currentFacingMode === 'user');
        }

        // Gắn trực tiếp thẻ <video muted playsinline autoplay> từ MediaStreamTrack.
        // Remote audio được phát độc lập bởi user.audioTrack.play(), nên <video> luôn phải muted=true để iOS WKWebView & Android WebView autoplay không bị chặn.
        try {
          const mediaStreamTrack = typeof track.getMediaStreamTrack === 'function' ? track.getMediaStreamTrack() : null;
          if (mediaStreamTrack) {
            let videoEl = container.querySelector('video.direct-rtc-video');
            if (videoEl && videoEl.dataset && videoEl.dataset.trackId === mediaStreamTrack.id && videoEl.srcObject) {
              if (videoEl.paused) {
                const pExisting = videoEl.play();
                if (pExisting && typeof pExisting.catch === 'function') pExisting.catch(() => {});
              }
              return;
            }
            if (!videoEl) {
              container.innerHTML = '';
              videoEl = document.createElement('video');
              videoEl.className = 'direct-rtc-video';
              videoEl.setAttribute('playsinline', '');
              videoEl.setAttribute('webkit-playsinline', '');
              videoEl.setAttribute('autoplay', '');
              videoEl.setAttribute('muted', '');
              videoEl.playsInline = true;
              videoEl.autoplay = true;
              videoEl.muted = true;
              videoEl.style.width = '100%';
              videoEl.style.height = '100%';
              videoEl.style.objectFit = 'cover';
              container.appendChild(videoEl);
            }
            videoEl.muted = true;
            videoEl.dataset.trackId = mediaStreamTrack.id;
            videoEl.srcObject = new MediaStream([mediaStreamTrack]);
            const p = videoEl.play();
            if (p && typeof p.catch === 'function') {
              p.catch((err) => log("Direct video.play() warn: " + err.message));
            }
            log((isLocal ? "Local" : "Remote") + " video attached via MediaStream (" + mediaStreamTrack.readyState + ")");
            return;
          }
        } catch (directErr) {
          log("Direct video attach failed, falling back to Agora play(): " + directErr.message);
        }

        try {
          track.play(container, { fit: 'cover' });
          const videos = container.querySelectorAll('video');
          videos.forEach((v) => {
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', '');
            v.setAttribute('muted', '');
            v.playsInline = true;
            v.autoplay = true;
            v.muted = true;
            const p = v.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          });
        } catch (playErr) {
          log("Agora video play error: " + playErr.message);
        }
      }

      async function createCameraTrack(facingMode) {
        const targetFacing = facingMode || 'user';
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await withTimeout(
              navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: { ideal: targetFacing },
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                  frameRate: { ideal: 24 }
                },
                audio: false
              }),
              6000,
              'getUserMedia(video)'
            );
            const rawVideoTrack = stream.getVideoTracks()[0];
            if (rawVideoTrack) {
              log("Acquired raw camera track via getUserMedia: " + rawVideoTrack.label);
              return AgoraRTC.createCustomVideoTrack({
                mediaStreamTrack: rawVideoTrack,
                optimizationMode: 'motion'
              });
            }
          } catch (vErr1) {
            log("getUserMedia(video facing) failed: " + (vErr1 && vErr1.name ? vErr1.name + ': ' : '') + (vErr1 && vErr1.message ? vErr1.message : vErr1));
          }

          try {
            const basicStream = await withTimeout(
              navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
              6000,
              'getUserMedia(video basic)'
            );
            const basicTrack = basicStream.getVideoTracks()[0];
            if (basicTrack) {
              log("Acquired raw camera track via getUserMedia(basic): " + basicTrack.label);
              return AgoraRTC.createCustomVideoTrack({
                mediaStreamTrack: basicTrack,
                optimizationMode: 'motion'
              });
            }
          } catch (vErr2) {
            log("getUserMedia(video basic) failed: " + (vErr2 && vErr2.name ? vErr2.name + ': ' : '') + (vErr2 && vErr2.message ? vErr2.message : vErr2));
          }
        }

        return await withTimeout(
          AgoraRTC.createCameraVideoTrack({
            facingMode: targetFacing,
            encoderConfig: '480p_1'
          }),
          8000,
          'createCameraVideoTrack'
        );
      }

      async function publishAudioTrackSafely(track) {
        if (!track || !client || window.hasLeftAgora || publishedAudio) return;
        try {
          await client.publish([track]);
          publishedAudio = true;
          log("Published local audio track");
        } catch (e) {
          log("Failed to publish audio track: " + e.message);
        }
      }

      async function publishVideoTrackSafely(track) {
        if (!track || !client || window.hasLeftAgora || publishedVideo) return;
        try {
          await client.publish([track]);
          publishedVideo = true;
          log("Published local video track");
        } catch (e) {
          log("Failed to publish video track: " + e.message);
        }
      }

      window.handleAction = async (action) => {
        if (action.type === 'join') {
          doJoin();
          return;
        }

        if (action.type === 'unlock-audio') {
          unlockAudio();
          return;
        }

        if (action.type === 'retry-mic') {
          if (!client || window.hasLeftAgora || isAcquiringAudio || isInitializingTracks) return;
          canUseMic = true;
          isAcquiringAudio = true;
          try {
            log("Retrying microphone track acquisition...");
            if (localTracks.audioTrack) {
              try { if (publishedAudio) await client.unpublish([localTracks.audioTrack]); } catch (e) {}
              try { localTracks.audioTrack.stop(); localTracks.audioTrack.close(); } catch (e) {}
              localTracks.audioTrack = null;
              publishedAudio = false;
            }
            localTracks.audioTrack = await acquireMicrophoneTrack();
            await localTracks.audioTrack.setEnabled(desiredMicEnabled);
            await publishAudioTrackSafely(localTracks.audioTrack);
            postToRN({ type: 'mic-ready' });
          } catch (e) {
            log("Retry microphone failed: " + e.message);
            postToRN({ type: 'mic-error', message: e.message });
          } finally {
            isAcquiringAudio = false;
          }
          return;
        }

        if (action.type === 'toggle-mic') {
          desiredMicEnabled = !!action.enabled;
          if (localTracks.audioTrack) {
            try {
              await localTracks.audioTrack.setEnabled(desiredMicEnabled);
            } catch (e) { log("Mic toggle error: " + e.message); }
          }
          return;
        }

        if (action.type === 'toggle-cam') {
          desiredCamEnabled = !!action.enabled;
          if (isInitializingTracks || isAcquiringVideo) {
            log("toggle-cam queued while camera/tracks are initializing: " + desiredCamEnabled);
            return;
          }
          try {
            const localPlayerEl = document.getElementById('local-player');
            const localContainerEl = document.getElementById('local-container');
            if (desiredCamEnabled) {
              canUseCam = true;
              if (!localTracks.videoTrack && client && isJoiningOrJoined) {
                isAcquiringVideo = true;
                try {
                  localTracks.videoTrack = await createCameraTrack(currentFacingMode);
                  renderVideoTrackToContainer(localTracks.videoTrack, localPlayerEl, true);
                  await publishVideoTrackSafely(localTracks.videoTrack);
                  postToRN({ type: 'cam-ready' });
                } finally {
                  isAcquiringVideo = false;
                }
              } else if (localTracks.videoTrack) {
                await localTracks.videoTrack.setEnabled(true);
                renderVideoTrackToContainer(localTracks.videoTrack, localPlayerEl, true);
              }
              if (localPlayerEl) localPlayerEl.style.display = 'block';
              if (localContainerEl) localContainerEl.style.display = 'flex';
            } else {
              if (localTracks.videoTrack) await localTracks.videoTrack.setEnabled(false);
              if (localPlayerEl) localPlayerEl.style.display = 'none';
              if ("${isGroup}" !== "true" && localContainerEl) {
                localContainerEl.style.display = 'none';
              }
            }
          } catch (e) {
            log("Cam error: " + e.message);
            postToRN({ type: 'cam-error', message: e.message });
          }
          return;
        }

        if (action.type === 'retry-cam') {
          if (!client || window.hasLeftAgora || isAcquiringVideo || isInitializingTracks) return;
          canUseCam = true;
          isAcquiringVideo = true;
          try {
            desiredCamEnabled = true;
            const localPlayerEl = document.getElementById('local-player');
            const localContainerEl = document.getElementById('local-container');
            if (localTracks.videoTrack) {
              try { if (publishedVideo) await client.unpublish([localTracks.videoTrack]); } catch (e) {}
              try { localTracks.videoTrack.stop(); localTracks.videoTrack.close(); } catch (e) {}
              localTracks.videoTrack = null;
              publishedVideo = false;
            }
            localTracks.videoTrack = await createCameraTrack(currentFacingMode);
            renderVideoTrackToContainer(localTracks.videoTrack, localPlayerEl, true);
            if (localContainerEl) localContainerEl.style.display = 'flex';
            await publishVideoTrackSafely(localTracks.videoTrack);
            postToRN({ type: 'cam-ready' });
          } catch (e) {
            log("Retry camera failed: " + e.message);
            postToRN({ type: 'cam-error', message: e.message });
          } finally {
            isAcquiringVideo = false;
          }
          return;
        }

        if (action.type === 'switch-camera') {
          if (!localTracks.videoTrack || !client || isAcquiringVideo || isInitializingTracks) return;
          isAcquiringVideo = true;
          try {
            const nextFacing = currentFacingMode === 'user' ? 'environment' : 'user';
            const oldTrack = localTracks.videoTrack;
            if (publishedVideo) {
              await client.unpublish([oldTrack]);
              publishedVideo = false;
            }
            oldTrack.stop();
            oldTrack.close();
            localTracks.videoTrack = null;
            localTracks.videoTrack = await createCameraTrack(nextFacing);
            currentFacingMode = nextFacing;
            if (!desiredCamEnabled) {
              await localTracks.videoTrack.setEnabled(false);
            }
            await publishVideoTrackSafely(localTracks.videoTrack);
            renderVideoTrackToContainer(localTracks.videoTrack, document.getElementById('local-player'), true);
            log("Switched camera to: " + currentFacingMode);
          } catch (e) {
            log("Switch camera error: " + e.message);
          } finally {
            isAcquiringVideo = false;
          }
          return;
        }

        if (action.type === 'leave') {
          if (window.hasLeftAgora) return;
          window.hasLeftAgora = true;
          try {
            if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
            if (localTracks.videoTrack) { localTracks.videoTrack.stop(); localTracks.videoTrack.close(); localTracks.videoTrack = null; }
            if (localTracks.audioTrack) { localTracks.audioTrack.stop(); localTracks.audioTrack.close(); localTracks.audioTrack = null; }
            if (client) {
              const c = client;
              client = null;
              window.agoraClient = null;
              await c.leave();
              log("Agora client left channel");
            }
          } catch (e) { log("Leave error: " + e.message); }
          return;
        }

        if (action.type === 'update-members') {
          memberMap = action.members || {};
          Object.keys(memberMap).forEach(uid => {
            const tile = document.getElementById(uid);
            if (tile) {
              const info = memberMap[uid];
              const lbl = tile.querySelector('.member-label');
              if (lbl) lbl.innerText = info.name;
              setAvatar(tile.querySelector('.avatar-circle'), info);
            }
          });
        }
      };

      function withTimeout(promise, ms, label) {
        return new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms);
          promise.then(
            (val) => { clearTimeout(t); resolve(val); },
            (err) => { clearTimeout(t); reject(err); }
          );
        });
      }

      async function doJoin() {
        log("doJoin started. callType: ${callType}, channel: ${config.channel}, uid: " + numericUid);
        if (window.isAgoraStarted) return;
        window.isAgoraStarted = true;
        window.hasLeftAgora = false;

        if (typeof AgoraRTC === 'undefined') {
          log("ERROR: AgoraRTC SDK failed to load from CDN");
          postToRN({ type: 'error', message: 'AgoraRTC SDK failed to load' });
          return;
        }

        try {
          client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
          window.agoraClient = client;

          let token = "${config.token}";
          if (token === "null" || token === "undefined" || !token || token === "") {
            token = null;
          }

          const localBox = document.getElementById('local-player');
          if (desiredCamEnabled) {
            localBox.style.display = 'block';
            document.getElementById('local-container').style.display = 'flex';
          }

          async function subscribeAndRender(user, mediaType) {
            if (!client || window.hasLeftAgora) return;
            const key = user.uid + '_' + mediaType;
            if (subscribedKeys.has(key)) return;
            subscribedKeys.add(key);

            log("Subscribing to remote user: " + user.uid + " (" + mediaType + ")");
            try {
              const tile = getOrCreateTile(user.uid);
              await client.subscribe(user, mediaType);
              log("Subscribed to: " + user.uid + " " + mediaType);

              if (mediaType === "video" && user.videoTrack) {
                const player = tile.querySelector('.video-view');
                if (player) {
                  renderVideoTrackToContainer(user.videoTrack, player, false);
                }
                document.body.classList.add('has-remote-video');
              }

              if (mediaType === "audio" && user.audioTrack) {
                try {
                  user.audioTrack.setVolume(100);
                  user.audioTrack.play();
                  log("Playing remote audio from: " + user.uid);
                  setTimeout(() => {
                    try { user.audioTrack && user.audioTrack.play(); } catch (e) {}
                  }, 350);
                } catch (e) {
                  log("Audio play error: " + e.message);
                  showUnlockLayer();
                }
              }

              postToRN({ type: 'user-published', uid: user.uid, mediaType });
            } catch (err) {
              log("Subscribe error: " + err.message);
              subscribedKeys.delete(key);
            }
          }

          client.on("user-joined", (user) => {
            log("User joined channel: " + user.uid);
            getOrCreateTile(user.uid);
            postToRN({ type: 'user-joined', uid: user.uid });
          });

          client.on("user-published", async (user, mediaType) => {
            log("User published: " + user.uid + " (" + mediaType + ")");
            await subscribeAndRender(user, mediaType);
          });

          client.on("user-unpublished", (user, mediaType) => {
            log("User unpublished: " + user.uid + " (" + mediaType + ")");
            subscribedKeys.delete(user.uid + '_' + mediaType);
            if (mediaType === "video") {
              const tile = document.getElementById(user.uid.toString());
              if (tile) {
                const player = tile.querySelector('.video-view');
                if (player) player.style.display = 'none';
              }
              const anyVideo = client && client.remoteUsers.some(u => u.hasVideo);
              if (!anyVideo) {
                document.body.classList.remove('has-remote-video');
              }
              postToRN({ type: 'user-unpublished', uid: user.uid, mediaType: 'video' });
            }
          });

          client.on("user-left", (user) => {
            log("User left channel: " + user.uid);
            subscribedKeys.delete(user.uid + '_audio');
            subscribedKeys.delete(user.uid + '_video');
            const el = document.getElementById(user.uid.toString());
            if (el) el.remove();
            const anyVideo = client && client.remoteUsers.some(u => u.hasVideo);
            if (!anyVideo) {
              document.body.classList.remove('has-remote-video');
            }
            updateGridLayout();
            postToRN({ type: 'user-left', uid: user.uid });
          });

          // Bước 1: Join channel NGAY LẬP TỨC trước để không bao giờ bị treo nếu getUserMedia chậm/lỗi
          log("Joining channel: ${config.channel} as " + numericUid);
          await client.join("${config.appId}", "${config.channel}", token, numericUid);
          if (window.hasLeftAgora) return;
          isJoiningOrJoined = true;
          log("Join success. Remote users existing: " + client.remoteUsers.length);
          postToRN({ type: 'joined' });

          // Bước 2: Subscribe ngay người đã có sẵn trong phòng để nghe được ngay lập tức
          for (const user of client.remoteUsers) {
            postToRN({ type: 'user-joined', uid: user.uid });
            getOrCreateTile(user.uid);
            if (user.hasAudio) subscribeAndRender(user, "audio");
            if (user.hasVideo) subscribeAndRender(user, "video");
          }

          // Bước 3: Mở micro + camera CHỈ cho những quyền đã được hệ điều hành cấp, và publish độc lập từng track
          isInitializingTracks = true;
          try {
            if (canUseMic && canUseCam && desiredCamEnabled && !window.hasLeftAgora && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              try {
                log("Requesting combined audio+video stream via single getUserMedia...");
                const combinedStream = await withTimeout(
                  navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    video: {
                      facingMode: { ideal: currentFacingMode || 'user' },
                      width: { ideal: 640 },
                      height: { ideal: 480 },
                      frameRate: { ideal: 24 }
                    }
                  }),
                  7000,
                  'getUserMedia(audio+video)'
                );

                const rawAudio = combinedStream.getAudioTracks()[0];
                const rawVideo = combinedStream.getVideoTracks()[0];

                if (rawAudio && !localTracks.audioTrack) {
                  localTracks.audioTrack = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: rawAudio });
                  await localTracks.audioTrack.setEnabled(desiredMicEnabled);
                  log("Combined audio track created: " + rawAudio.label);
                  await publishAudioTrackSafely(localTracks.audioTrack);
                  postToRN({ type: 'mic-ready' });
                }

                if (rawVideo && !localTracks.videoTrack) {
                  localTracks.videoTrack = AgoraRTC.createCustomVideoTrack({
                    mediaStreamTrack: rawVideo,
                    optimizationMode: 'motion'
                  });
                  renderVideoTrackToContainer(localTracks.videoTrack, localBox, true);
                  document.getElementById('local-container').style.display = 'flex';
                  log("Combined video track created: " + rawVideo.label);
                  await publishVideoTrackSafely(localTracks.videoTrack);
                  postToRN({ type: 'cam-ready' });
                }
              } catch (combErr) {
                log("Combined getUserMedia(audio+video) failed: " + (combErr && combErr.name ? combErr.name + ': ' : '') + (combErr && combErr.message ? combErr.message : combErr));
              }
            }

            if (canUseMic && !localTracks.audioTrack && !window.hasLeftAgora) {
              try {
                log("Requesting microphone track...");
                localTracks.audioTrack = await acquireMicrophoneTrack();
                await localTracks.audioTrack.setEnabled(desiredMicEnabled);
                log("Local audio track created");
                await publishAudioTrackSafely(localTracks.audioTrack);
                postToRN({ type: 'mic-ready' });
              } catch (audioError) {
                log("Failed to create local audio track: " + audioError.message);
                postToRN({ type: 'mic-error', message: audioError.message });
              }
            } else if (!canUseMic) {
              log("Skipping microphone capture because OS RECORD_AUDIO permission is not granted yet");
              postToRN({ type: 'mic-error', message: 'OS microphone permission not granted' });
            }

            if (desiredCamEnabled && canUseCam && !localTracks.videoTrack && !window.hasLeftAgora) {
              try {
                log("Requesting camera track...");
                localTracks.videoTrack = await createCameraTrack(currentFacingMode);
                renderVideoTrackToContainer(localTracks.videoTrack, localBox, true);
                document.getElementById('local-container').style.display = 'flex';
                log("Local video track created");
                await publishVideoTrackSafely(localTracks.videoTrack);
                postToRN({ type: 'cam-ready' });
              } catch (videoError) {
                log("Failed to create local video track: " + videoError.message);
                postToRN({ type: 'cam-error', message: videoError.message });
                if ("${isGroup}" !== "true") {
                  document.getElementById('local-container').style.display = 'none';
                }
              }
            } else if (desiredCamEnabled && !canUseCam) {
              log("Skipping camera capture because OS CAMERA permission is not granted yet");
              postToRN({ type: 'cam-error', message: 'OS camera permission not granted' });
              if ("${isGroup}" !== "true") {
                document.getElementById('local-container').style.display = 'none';
              }
            }
          } finally {
            isInitializingTracks = false;
          }

          // Đồng bộ lại trạng thái cam/mic nếu người dùng đã bấm nút trong lúc đang khởi tạo
          if (localTracks.audioTrack) {
            try { await localTracks.audioTrack.setEnabled(desiredMicEnabled); } catch (e) {}
          }
          if (localTracks.videoTrack) {
            try {
              await localTracks.videoTrack.setEnabled(desiredCamEnabled);
              if (!desiredCamEnabled) {
                document.getElementById('local-player').style.display = 'none';
                if ("${isGroup}" !== "true") document.getElementById('local-container').style.display = 'none';
              }
            } catch (e) {}
          }

          // Re-trigger remote audio playback sau khi mở mic/publish (đặc biệt quan trọng trên iOS WKWebView)
          setTimeout(replayAllRemoteAudio, 300);
          setTimeout(replayAllRemoteAudio, 1000);

          updateGridLayout();

          heartbeatTimer = setInterval(() => {
            if (window.agoraClient && !window.hasLeftAgora) {
              const remoteUsers = window.agoraClient.remoteUsers;
              remoteUsers.forEach((u) => {
                if (u.hasAudio && !subscribedKeys.has(u.uid + '_audio')) {
                  subscribeAndRender(u, "audio");
                }
                if (u.hasVideo && !subscribedKeys.has(u.uid + '_video')) {
                  subscribeAndRender(u, "video");
                }
              });
              const videoUids = remoteUsers.filter(u => u.hasVideo).map(u => u.uid);
              const uids = remoteUsers.map(u => u.uid);
              postToRN({
                type: 'sync',
                count: remoteUsers.length,
                videoUids,
                uids
              });
            }
          }, 2000);
        } catch (e) {
          log("Join error: " + e.message);
          postToRN({ type: 'error', message: e.message });
        }
      }

      // Draggable PIP Box for 1-1 Single Mode
      if ("${isGroup}" !== "true") {
        (function () {
          const localBox = document.getElementById('local-container');
          let isDragging = false;
          let startX = 0, startY = 0;
          let offsetX = 0, offsetY = 0;

          localBox.addEventListener('touchstart', (e) => {
            if (!document.body.classList.contains('has-remote-video')) return;
            isDragging = true;
            localBox.classList.add('dragging');
            const touch = e.touches[0];
            startX = touch.clientX - offsetX;
            startY = touch.clientY - offsetY;
            localBox.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(1.06)';
          }, { passive: false });

          localBox.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const touch = e.touches[0];
            offsetX = touch.clientX - startX;
            offsetY = touch.clientY - startY;
            localBox.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(1.06)';
          }, { passive: false });

          const releasePIP = () => {
            if (!isDragging) return;
            isDragging = false;
            localBox.classList.remove('dragging');
            const maxX = 16;
            const minX = -(window.innerWidth - 108 - 32);
            const maxY = window.innerHeight - 360;
            const minY = -20;
            offsetX = Math.max(minX, Math.min(maxX, offsetX));
            offsetY = Math.max(minY, Math.min(maxY, offsetY));
            localBox.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(1)';
          };

          localBox.addEventListener('touchend', releasePIP);
          localBox.addEventListener('touchcancel', releasePIP);
        })();
      }

      setTimeout(() => {
        window.handleAction({ type: 'join' });
      }, 250);
    </script>
  </body>
</html>
    `;
};



