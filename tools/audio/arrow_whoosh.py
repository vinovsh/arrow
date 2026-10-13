"""Approved option 4: original 260ms glassy glide, identical to the audition master."""
import math
import pathlib
import struct
import subprocess
import tempfile
import wave

rate, duration = 44100, 0.26
samples = []
for i in range(round(rate * duration)):
    t = i / rate
    envelope = (1 - math.exp(-t / 0.004)) * math.exp(-t / 0.062)
    phase = 2 * math.pi * (960 * t + 330 * 0.032 * (1 - math.exp(-t / 0.032)))
    value = (0.7 * math.sin(phase) + 0.23 * math.sin(phase * 1.5) + 0.10 * math.sin(phase * 2)) * envelope
    samples.append(value * min(1, (duration - t) / 0.02))
peak = max(abs(s) for s in samples)
rms = math.sqrt(sum(s * s for s in samples) / len(samples))
gain = min(0.06 / rms, 0.34 / peak)
payload = b''.join(struct.pack('<h', round(max(-1, min(1, s * gain)) * 32767)) for s in samples)
output = pathlib.Path('android/app/src/main/res/raw/arrow_move.m4a')
with tempfile.TemporaryDirectory() as temp:
    master = pathlib.Path(temp) / 'glassy_glide.wav'
    with wave.open(str(master), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(payload)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(master), '-c:a', 'aac', '-b:a', '96k', '-ar', str(rate), '-ac', '1', str(output)], check=True)
print(output)
