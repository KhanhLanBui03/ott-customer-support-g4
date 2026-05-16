
import wave
import struct
import math
import os

os.makedirs('web/public/sounds', exist_ok=True)

def generate_beep(filename, duration=1.0, freq=440.0, volume=0.5, silence=0.5):
    sample_rate = 44100.0
    num_samples = int(sample_rate * duration)
    silence_samples = int(sample_rate * silence)
    
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(int(sample_rate))
        
        # Tone
        for i in range(num_samples):
            value = int(volume * 32767.0 * math.sin(2.0 * math.pi * freq * i / sample_rate))
            data = struct.pack('<h', value)
            f.writeframesraw(data)
        
        # Silence
        for i in range(silence_samples):
            f.writeframesraw(struct.pack('<h', 0))

# Waiting tone: Standard "Tuuuu... silence" (repeatable)
generate_beep('web/public/sounds/dialing.wav', duration=1.0, freq=425.0, volume=0.3, silence=2.0)

# Ringtone: Double beep melody (repeatable)
def generate_ringtone(filename, repeats=5):
    sample_rate = 44100.0
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(int(sample_rate))
        
        for _ in range(repeats):
            # Beep 1
            for i in range(int(sample_rate * 0.2)):
                v = int(0.5 * 32767.0 * math.sin(2.0 * math.pi * 660.0 * i / sample_rate))
                f.writeframesraw(struct.pack('<h', v))
            # Short silence
            for i in range(int(sample_rate * 0.1)):
                f.writeframesraw(struct.pack('<h', 0))
            # Beep 2
            for i in range(int(sample_rate * 0.2)):
                v = int(0.5 * 32767.0 * math.sin(2.0 * math.pi * 880.0 * i / sample_rate))
                f.writeframesraw(struct.pack('<h', v))
            # Long silence
            for i in range(int(sample_rate * 1.5)):
                f.writeframesraw(struct.pack('<h', 0))

generate_ringtone('web/public/sounds/ringtone.wav')
print('Ringtone files generated successfully!')
