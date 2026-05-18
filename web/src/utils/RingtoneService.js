class RingtoneService {
    constructor() {
        this.audioCtx = null;
        this.isPlaying = false;
        this.timeoutIds = [];
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
    }

    // Modern Marimba-like ringtone for Incoming Calls
    playIncoming() {
        this.stop();
        this.init();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        this.isPlaying = true;

        const playSequence = () => {
            if (!this.isPlaying) return;
            const now = this.audioCtx.currentTime;
            
            // Note sequence (frequencies in Hz)
            const notes = [
                { f: 659.25, d: 0.1, t: 0.0 }, // E5
                { f: 880.00, d: 0.1, t: 0.15 }, // A5
                { f: 659.25, d: 0.1, t: 0.3 }, // E5
                { f: 880.00, d: 0.1, t: 0.45 }, // A5
                { f: 1046.50, d: 0.2, t: 0.6 }, // C6
            ];

            notes.forEach(note => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                
                osc.type = 'sine';
                osc.frequency.value = note.f;
                
                gain.gain.setValueAtTime(0, now + note.t);
                gain.gain.linearRampToValueAtTime(0.5, now + note.t + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d + 0.1);
                
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                
                osc.start(now + note.t);
                osc.stop(now + note.t + note.d + 0.1);
            });

            this.timeoutIds.push(setTimeout(playSequence, 2000));
        };

        playSequence();
    }

    // Standard Dial Tone for Outgoing Calls
    playOutgoing() {
        this.stop();
        this.init();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        this.isPlaying = true;

        const playBeep = () => {
            if (!this.isPlaying) return;
            const now = this.audioCtx.currentTime;

            const osc1 = this.audioCtx.createOscillator();
            const osc2 = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            // 425Hz is the standard European/Asian ringback tone
            osc1.type = 'sine';
            osc1.frequency.value = 425;
            osc2.type = 'sine';
            osc2.frequency.value = 425;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
            gain.gain.setValueAtTime(0.2, now + 1.4);
            gain.gain.linearRampToValueAtTime(0, now + 1.5);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 1.5);
            osc2.stop(now + 1.5);

            this.timeoutIds.push(setTimeout(playBeep, 4000));
        };

        playBeep();
    }

    playBusy() {
        this.stop();
        this.init();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        this.isPlaying = true;

        const now = this.audioCtx.currentTime;
        // 3 beeps: 0.5s on, 0.5s off
        for (let i = 0; i < 3; i++) {
            const start = now + i * 0.8;
            [480, 620].forEach(f => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = f;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
                gain.gain.setValueAtTime(0.15, start + 0.35);
                gain.gain.linearRampToValueAtTime(0, start + 0.4);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(start);
                osc.stop(start + 0.4);
            });
        }
    }

    stop() {
        this.isPlaying = false;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        window.speechSynthesis?.cancel(); // Stop TTS if playing
    }

    // Voice notification for unreachable
    playUnreachable() {
        this.stop();
        this.init();
        
        // 1. Play busy tone (short beeps)
        const playBusyTone = () => {
            const now = this.audioCtx.currentTime;
            for (let i = 0; i < 3; i++) {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                
                osc.type = 'sine';
                osc.frequency.value = 480;
                
                gain.gain.setValueAtTime(0, now + i * 0.5);
                gain.gain.linearRampToValueAtTime(0.3, now + i * 0.5 + 0.05);
                gain.gain.setValueAtTime(0.3, now + i * 0.5 + 0.25);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.5 + 0.3);
                
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                
                osc.start(now + i * 0.5);
                osc.stop(now + i * 0.5 + 0.3);
            }
        };

        // 2. Play Text-to-Speech voice
        const playVoice = () => {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance("Người nhận không liên lạc được, xin quý khách vui lòng gọi lại sau.");
                utterance.lang = 'vi-VN';
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        };

        playBusyTone();
        // playVoice disabled

    }
}

export const ringtoneService = new RingtoneService();
