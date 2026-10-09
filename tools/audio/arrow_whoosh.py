"""Original, deterministic movement sound. Run from the repository root."""
import math
import pathlib
import random
import struct
import subprocess
import tempfile
import wave

rate, duration = 44100, 0.27
rng = random.Random(20261009)
low = slow = 0.0
samples = []
for i in range(round(rate * duration)):
    t = i / rate
    noise = rng.uniform(-1, 1)
    # A warm band of air: remove brittle highs and rumble.
    low += 0.19 * (noise - low)
    slow += 0.012 * (low - slow)
    envelope = math.sin(math.pi * t / duration) ** 1.6
    tone = math.sin(2 * math.pi * (850 * t - 800 * t * t))
    samples.append((0.92 * (low - slow) + 0.025 * tone) * envelope)
peak = max(abs(s) for s in samples)
payload = b''.join(struct.pack('<h', round(s / peak * 0.30 * 32767)) for s in samples)
output = pathlib.Path('android/app/src/main/res/raw/arrow_move.m4a')
with tempfile.TemporaryDirectory() as temp:
    master = pathlib.Path(temp) / 'whoosh.wav'
    with wave.open(str(master), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(payload)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(master), '-c:a', 'aac', '-b:a', '96k', '-ar', str(rate), '-ac', '1', str(output)], check=True)
print(output)
