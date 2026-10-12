"""Original silky arrow glide: quick rounded onset, airy zip, warm falling tone."""
import math
import pathlib
import random
import struct
import subprocess
import tempfile
import wave

rate, duration = 44100, 0.235
rng = random.Random(20261012)
low = slow = 0.0
samples = []
for i in range(round(rate * duration)):
    t = i / rate
    u = t / duration
    # Swept, band-limited air: softens throughout the exit, with no brittle hiss.
    cutoff = 0.24 * (1 - u) + 0.065
    low += cutoff * (rng.uniform(-1, 1) - low)
    slow += 0.025 * (low - slow)
    air_env = (1 - math.exp(-t / 0.006)) * math.exp(-t / 0.064) * (1 - u) ** 1.3
    # Continuous-phase descending glide; a quiet warm onset adds tactile feedback.
    phase = 2 * math.pi * (460 * t + 610 * 0.036 * (1 - math.exp(-t / 0.036)))
    glide = math.sin(phase) * (1 - math.exp(-t / 0.0025)) * math.exp(-t / 0.043)
    pop_phase = 2 * math.pi * (220 * t + 260 * 0.014 * (1 - math.exp(-t / 0.014)))
    pop = math.sin(pop_phase) * (1 - math.exp(-t / 0.0018)) * math.exp(-t / 0.016)
    fade = min(1, (duration - t) / 0.018)
    samples.append((1.1 * (low - slow) * air_env + 0.075 * glide + 0.035 * pop) * fade)
peak = max(abs(s) for s in samples)
payload = b''.join(struct.pack('<h', round(s / peak * 0.32 * 32767)) for s in samples)
output = pathlib.Path('android/app/src/main/res/raw/arrow_move.m4a')
with tempfile.TemporaryDirectory() as temp:
    master = pathlib.Path(temp) / 'arrow_glide.wav'
    with wave.open(str(master), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(payload)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(master), '-c:a', 'aac', '-b:a', '96k', '-ar', str(rate), '-ac', '1', str(output)], check=True)
print(output)
