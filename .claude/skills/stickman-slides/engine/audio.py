"""Sound for cinema decks: every effect and the music bed are synthesised here (numpy only), so there are
no third-party audio files and no licence questions. Deterministic: same deck → same sound.
Usage: python3 audio.py <outDir>   (needs meta.json + slideN.mp4 from render_cinema.js; muxes slideN.mp4 in place)"""
import json, os, sys, wave, subprocess
import numpy as np

SR = 44100
rng = np.random.default_rng(7)

def env(n, a=0.005, r=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    if r: e *= np.exp(-t / r)
    return e
def tone(f0, f1, dur, r=None, a=0.004, harm=(1,)):
    n = int(dur * SR); f = np.geomspace(f0, f1, n) if f0 > 0 and f1 > 0 else np.full(n, f0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum(np.sin(ph * k) / (i + 1) for i, k in enumerate(harm))
    return s * env(n, a, r)
def noise(dur): return rng.standard_normal(int(dur * SR))
def band(x, lo, hi):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR); X[(fr < lo) | (fr > hi)] = 0; return np.fft.irfft(X, len(x))
def lowpass(x, hi): return band(x, 0, hi)
def norm(x, p=1.0): m = np.max(np.abs(x)) or 1; return x / m * p

def sweep_noise(dur, f0, f1, bw=0.6):
    n = int(dur * SR); out = np.zeros(n); x = noise(dur); k = 48
    for i in range(k):
        a, b = i * n // k, (i + 1) * n // k; c = f0 * (f1 / f0) ** (i / (k - 1))
        out[a:b] = band(x, c * (1 - bw), c * (1 + bw))[a:b]
    return out

def fx(name):
    if name == 'whoosh':
        s = sweep_noise(0.9, 300, 3000); return norm(s * np.hanning(len(s)), .9)
    if name == 'thud':
        s = tone(110, 45, .45, r=.12) + lowpass(noise(.45), 400) * env(int(.45 * SR), .002, .05) * .6; return norm(s, 1)
    if name == 'bigthud':
        s = tone(80, 32, .9, r=.25) + lowpass(noise(.9), 250) * env(int(.9 * SR), .002, .18) * .8; return norm(s, 1)
    if name == 'pop':
        return norm(tone(380, 950, .09, r=.03), .7)
    if name == 'twinkle':
        out = np.zeros(int(1.0 * SR))
        for i, f in enumerate([1568, 2093, 2637, 3136]):
            s = tone(f, f, .5, r=.12, harm=(1, 2)); o = int(i * .09 * SR); out[o:o + len(s)] += s
        return norm(out, .5)
    if name == 'crack':
        s = band(noise(.25), 1800, 9000) * env(int(.25 * SR), .001, .04)
        for o in (0.0, .03, .07): k = int(o * SR); s[k:k + 200] += np.sign(rng.standard_normal(200)) * .8
        return norm(s, .9)
    if name == 'boing':
        n = int(.7 * SR); t = np.arange(n) / SR; f = 180 * (1 + .35 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 4))
        return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .003, .22), .7)
    if name == 'chop':
        s = tone(560, 380, .14, r=.03, harm=(1, 2.7)) + band(noise(.14), 1500, 6000) * env(int(.14 * SR), .001, .01) * .7; return norm(s, 1)
    if name == 'spark':
        s = band(noise(.12), 3000, 10000) * env(int(.12 * SR), .001, .02); return norm(s, .6)
    if name == 'ignite':
        s = sweep_noise(1.2, 200, 1200, .8) * np.linspace(.2, 1, int(1.2 * SR)) ** 2; return norm(s, .8)
    if name == 'crackle':           # 1 s of fire crackle (loop it via repeated cues)
        out = band(noise(1.0), 300, 2500) * .05
        for _ in range(14): k = rng.integers(0, SR - 400); out[k:k + 300] += band(noise(300 / SR), 1500, 8000) * rng.uniform(.3, 1)
        return norm(out, .45)
    if name == 'trumpet':           # mammoth
        n = int(1.4 * SR); t = np.arange(n) / SR; f = 220 + 160 * np.minimum(1, t / .3) + 12 * np.sin(2 * np.pi * 7 * t)
        ph = 2 * np.pi * np.cumsum(f) / SR; s = sum(np.sin(ph * k) / k for k in range(1, 9)); s = lowpass(s, 2600)
        return norm(s * env(n, .05) * np.clip((1.4 - t) / .3, 0, 1), .9)
    if name == 'run':               # cartoon scramble (xylophone run)
        out = np.zeros(int(.9 * SR))
        for i in range(12): f = 523 * 2 ** ((i % 6) / 6); s = tone(f, f, .1, r=.03, harm=(1, 3)); o = int(i * .07 * SR); out[o:o + len(s)] += s
        return norm(out, .6)
    if name == 'ding':
        return norm(tone(1318, 1318, 1.2, r=.4, harm=(1, 2.01, 3.03)), .55)
    if name == 'step':
        return norm(tone(90, 60, .12, r=.03) + lowpass(noise(.12), 600) * env(int(.12 * SR), .001, .02) * .5, .5)
    if name == 'applause':
        n = int(2.5 * SR); out = np.zeros(n)
        for _ in range(500): k = rng.integers(0, n - 800); out[k:k + 600] += band(noise(600 / SR), 800, 6000) * env(600, .0005, .004)
        return norm(out * np.minimum(1, np.linspace(2.5, 0, n)), .6)
    if name == 'powerdown':
        return norm(tone(880, 110, .7, r=.35, harm=(1, 3)), .55)
    if name == 'spray':
        s = band(noise(.45), 1200, 7000) * env(int(.45 * SR), .02, .15); return norm(s, .7)
    if name == 'neigh':             # cartoon horse whinny
        n = int(1.0 * SR); t = np.arange(n) / SR; f = 700 + 350 * np.sin(2 * np.pi * 11 * t) * np.exp(-t * 2) - 300 * t
        ph = 2 * np.pi * np.cumsum(f) / SR; s = sum(np.sin(ph * k) / k for k in range(1, 5))
        return norm(s * env(n, .02) * np.clip((1.0 - t) / .4, 0, 1), .6)
    if name == 'hay':
        s = band(noise(.6), 800, 5000) * env(int(.6 * SR), .005, .2); s[:int(.3 * SR)] += tone(120, 60, .3, r=.08) * .6; return norm(s, .8)
    if name == 'chalk':
        out = np.zeros(int(.8 * SR))
        for i in range(6): k = int(i * .12 * SR); out[k:k + 2500] += band(noise(2500 / SR), 2500, 9000) * env(2500, .002, .02)
        return norm(out, .35)
    raise ValueError('unknown sfx ' + name)

def music(dur, bpm=100, seed=3):
    """light cartoon bed: low drum on beats, shaker on 8ths, pentatonic marimba melody (4-bar phrase)"""
    r = np.random.default_rng(seed); n = int(dur * SR); out = np.zeros(n + SR); beat = 60 / bpm
    scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3]
    phrase = [r.integers(0, len(scale)) if r.random() > .25 else -1 for _ in range(16)]
    drum = tone(95, 50, .3, r=.09); shk = band(noise(.06), 5000, 11000) * env(int(.06 * SR), .001, .015) * .25
    i = 0; t = 0.0
    while t < dur:
        k = int(t * SR)
        if i % 2 == 0: d = drum * (1 if i % 8 == 0 else .55); out[k:k + len(d)] += d
        out[k:k + len(shk)] += shk
        nt = phrase[i % 16]
        if nt >= 0 and i % 2 == 0:
            f = scale[nt]; m = tone(f, f, .5, r=.12, harm=(1, 4.0)) * .5; m[:int(.3 * SR)] += tone(f * 2, f * 2, .3, r=.06) * .12; out[k:k + len(m)] += m
        i += 1; t += beat / 2
    out = out[:n]; fade = int(1.5 * SR); out[-fade:] *= np.linspace(1, 0, fade)
    return norm(out, 1)

def place(buf, s, t, gain):
    k = int(t * SR); e = min(len(buf), k + len(s)); buf[k:e] += s[:e - k] * gain

def build(meta_slide, dur):
    n = int(dur * SR); buf = np.zeros(n)
    if meta_slide.get('music'): place(buf, music(dur), 0, .16)
    cache = {}
    for t, name, gain in meta_slide.get('sfx', []):
        if name not in cache: cache[name] = fx(name)
        place(buf, cache[name], t, gain * .8)
    pk = np.max(np.abs(buf)) or 1
    if pk > .95: buf = buf / pk * .95
    return buf

def write_wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())

if __name__ == '__main__':
    out = sys.argv[1]; meta = json.load(open(os.path.join(out, 'meta.json')))
    for s in meta['slides']:
        v = os.path.join(out, f"slide{s['n']}.mp4")
        if not os.path.exists(v): continue
        wav = os.path.join(out, f"slide{s['n']}.wav"); write_wav(wav, build(s, s['D']))
        tmp = v + '.tmp.mp4'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', v, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', tmp], check=True)
        os.replace(tmp, v); print('sound →', v)
