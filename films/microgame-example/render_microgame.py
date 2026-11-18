#!/usr/bin/env python3
"""Cadet Frenzy — Microgame Frenzy example (Lemo-Opuscar styles/microgame).
Python port: flat-toon home stage + TV frame-within-frame, 3 media games
(crayon / pixel / blueprint) + mixed-media boss, command words, fuse timer,
lives, slot-reel speed-ups, groove + colour instruments. Original art/music.
15s, 1920x1080, 24fps.
"""
import math, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
OUT_MP4 = ROOT / "cadet_frenzy.mp4"
OUT_WAV = ROOT / "soundtrack.wav"
OUT_SRT = ROOT / "subtitles_en.srt"
OUT_POSTER = ROOT / "poster.jpg"

W, H = 1920, 1080
FPS = 24
DUR = 15.0
NFRAMES = int(FPS * DUR)
SR = 44100
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# home palette (from DEMO.md)
INK = (26, 16, 48)
VIOLET = (42, 15, 92)
VIOLET2 = (61, 22, 143)
MAGENTA = (255, 46, 136)
GOLD = (255, 201, 40)
GOLD_D = (224, 138, 0)
CYAN = (31, 209, 209)
GREEN = (59, 220, 90)
RED = (255, 59, 59)
WHITE = (255, 255, 255)
CREAM = (255, 246, 220)

TV_X, TV_Y, TV_W, TV_H = (W-768)//2, 180, 768, 432  # gold TV screen

def font(sz): return ImageFont.truetype(FONT_BOLD, sz)

def toon_box(d, box, fill, outline=INK, ow=7, shadow=True):
    x0, y0, x1, y1 = box
    if shadow:
        d.rectangle([x0-9, y0-9, x1-9, y1-9], fill=(0, 0, 0))
    d.rectangle(box, fill=fill, outline=outline, width=ow)

def sunburst(d, cx, cy, r, t):
    # rotating sunburst: alternating violet shades
    for i in range(24):
        a0 = (i*15 + t*8) % 360
        a1 = a0 + 15
        d.pieslice([cx-r, cy-r, cx+r, cy+r], a0, a1, fill=VIOLET if i % 2 == 0 else VIOLET2)

def draw_host(d, x, y, s, t, excited=False):
    # stopwatch head: gold dial face, red second hand = nose/pointer
    r = int(46*s)
    d.ellipse([x-r, y-r, x+r, y+r], fill=GOLD, outline=INK, width=7)
    d.ellipse([x-r+10, y-r+10, x+r-10, y+r-10], fill=CREAM, outline=INK, width=4)
    # crown button
    d.rectangle([x-10*s, y-r-16*s, x+10*s, y-r-2], fill=RED, outline=INK, width=4)
    # tick marks
    for i in range(12):
        a = i*30
        x1 = x + (r-14)*math.cos(math.radians(a)); y1 = y + (r-14)*math.sin(math.radians(a))
        x2 = x + (r-8)*math.cos(math.radians(a)); y2 = y + (r-8)*math.sin(math.radians(a))
        d.line([x1, y1, x2, y2], fill=INK, width=3)
    # second hand (nose/pointer) — ticks on beat, spins when excited
    ang = (t*360) % 360 if excited else (int(t*2) % 2)*30 - 15
    hx = x + (r-16)*math.cos(math.radians(ang-90)); hy = y + (r-16)*math.sin(math.radians(ang-90))
    d.line([x, y, hx, hy], fill=RED, width=6)
    d.ellipse([x-6, y-6, x+6, y+6], fill=INK)
    # eyes
    d.ellipse([x-18, y-10, x-6, y+2], fill=INK); d.ellipse([x+6, y-10, x+18, y+2], fill=INK)
    # body
    d.rectangle([x-30*s, y+r, x+30*s, y+r+60*s], fill=MAGENTA, outline=INK, width=6)
    # arms: one ticks every beat
    tick = int(t*2) % 2
    d.line([x-30*s, y+r+20*s, x-52*s, y+r+(30 if tick else 10)*s], fill=INK, width=10)
    d.line([x+30*s, y+r+20*s, x+52*s, y+r+40*s], fill=INK, width=10)

def draw_hero_toon(d, x, y, s, t, pose='stand'):
    # cadet: bubble helmet, red cap (mark), white star chest (mark), "05"
    # body
    d.rectangle([x-28*s, y, x+28*s, y+70*s], fill=CYAN, outline=INK, width=6)
    d.rectangle([x-28*s, y+58*s, x+28*s, y+70*s], fill=VIOLET2, outline=INK, width=4)
    # legs
    d.rectangle([x-24*s, y+70*s, x-6*s, y+96*s], fill=INK)
    d.rectangle([x+6*s, y+70*s, x+24*s, y+96*s], fill=INK)
    # star chest (white star mark)
    cx, cy, R = x, y+32*s, 14*s
    pts = []
    for i in range(10):
        rr = R if i % 2 == 0 else R*0.45
        a = -90 + i*36
        pts.append((cx+rr*math.cos(math.radians(a)), cy+rr*math.sin(math.radians(a))))
    d.polygon(pts, fill=WHITE, outline=INK)
    # helmet
    hr = 34*s
    d.ellipse([x-hr, y-hr-10*s, x+hr, y+hr-10*s], fill=(200, 240, 255), outline=INK, width=6)
    d.ellipse([x-hr+8, y-hr-2*s, x+hr-8, y+hr-18*s], fill=WHITE)
    # face
    d.ellipse([x-14*s, y-8*s, x-4*s, y+2*s], fill=INK); d.ellipse([x+4*s, y-8*s, x+14*s, y+2*s], fill=INK)
    d.arc([x-10*s, y+2*s, x+10*s, y+12*s], 0, 180, fill=INK, width=3)
    # red cap (mark)
    d.pieslice([x-hr, y-hr-10*s, x+hr, y+10*s], 180, 360, fill=RED, outline=INK, width=5)
    d.rectangle([x-hr-6*s, y-12*s, x+hr+6*s, y-2*s], fill=RED, outline=INK, width=4)
    # antenna + orange ball (mark)
    d.line([x, y-hr-10*s, x, y-hr-30*s], fill=INK, width=4)
    d.ellipse([x-8*s, y-hr-46*s, x+8*s, y-hr-30*s], fill=GOLD_D, outline=INK, width=4)
    # "05"
    f = font(int(18*s))
    d.text((x-14*s, y+44*s), "05", font=f, fill=WHITE, stroke_width=2, stroke_fill=INK)
    if pose == 'jump':
        d.line([x-28*s, y+20*s, x-48*s, y-10*s], fill=INK, width=10)
        d.line([x+28*s, y+20*s, x+48*s, y-10*s], fill=INK, width=10)
    elif pose == 'kneel':
        d.rectangle([x-30*s, y+70*s, x+30*s, y+96*s], fill=CYAN, outline=INK, width=5)

def draw_lives(d, x, y, n, blink=False):
    for i in range(3):
        cx = x + i*56
        col = RED if i < n else (90, 70, 130)
        if blink and i == n: col = WHITE if int(y*0) == 0 else RED
        # helmet icon
        d.ellipse([cx-20, y-20, cx+20, y+20], fill=col, outline=INK, width=5)
        d.ellipse([cx-12, y-12, cx+12, y+8], fill=WHITE if i < n else (60, 50, 90))
    d.text((x-4, y+28), "LIVES", font=font(20), fill=WHITE, stroke_width=3, stroke_fill=INK)

def draw_command(d, word, cx, cy, scale=1.0, skew=-6):
    # burst behind
    f = font(int(96*scale))
    bbox = d.textbbox((0, 0), word, font=f, stroke_width=14)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    x0, y0 = cx-tw//2, cy-th//2
    # gold burst (star polygon)
    burst = []
    for i in range(24):
        a = i*15
        rr = 1.0 if i % 2 == 0 else 0.78
        burst.append((cx + rr*(tw*0.62)*math.cos(math.radians(a)), cy + rr*(th*0.95)*math.sin(math.radians(a))))
    d.polygon(burst, fill=GOLD, outline=INK)
    # magenta drop
    d.text((x0+8, y0+8), word, font=f, fill=MAGENTA, stroke_width=14, stroke_fill=INK)
    # white fill
    d.text((x0, y0), word, font=f, fill=WHITE, stroke_width=14, stroke_fill=INK)

def draw_fuse(d, x0, y0, x1, prog, t):
    # braided rope with knots per beat; spark passes knots on beat
    d.line([x0, y0, x1, y0], fill=(150, 100, 40), width=8)
    d.line([x0, y0, x1, y0], fill=(220, 170, 90), width=3)
    nk = 6
    for i in range(nk+1):
        kx = x0 + (x1-x0)*i/nk
        d.ellipse([kx-5, y0-5, kx+5, y0+5], fill=INK)
    sx = x0 + (x1-x0)*min(1.0, prog)
    # spark
    fl = 8 + 4*math.sin(t*40)
    d.ellipse([sx-fl, y0-fl, sx+fl, y0+fl], fill=GOLD, outline=RED, width=3)
    d.ellipse([sx-3, y0-3, sx+3, y0+3], fill=WHITE)

def draw_stamp(d, cx, cy, ok, scale=1.0):
    col = GREEN if ok else RED
    sym = "✓" if ok else "✗"
    f = font(int(110*scale))
    d.ellipse([cx-70*scale, cy-70*scale, cx+70*scale, cy+70*scale], fill=col, outline=INK, width=10)
    d.text((cx-38*scale, cy-52*scale), sym, font=f, fill=WHITE, stroke_width=4, stroke_fill=INK)

# ---------- game media (drawn into TV screen 768x432) ----------
def game_crayon(t, lt, dur):
    # lt = local time in game, dur = game duration
    im = Image.new('RGB', (TV_W, TV_H), (250, 244, 224))
    d = ImageDraw.Draw(im, 'RGBA')
    # paper tooth noise
    rng = np.random.default_rng(3)
    tooth = rng.random((TV_H//4, TV_W//4))
    for yy in range(0, TV_H, 4):
        for xx in range(0, TV_W, 4):
            v = int(235 + tooth[yy//4, xx//4]*20)
            d.rectangle([xx, yy, xx+3, yy+3], fill=(v, v-5, v-25))
    # hero (crayon style: wobbly outline, red cap + star)
    hx, hy = 180, 220
    d.ellipse([hx-50, hy-110, hx+50, hy-10], fill=(200, 240, 255, 220), outline=(60, 60, 120, 255), width=5)
    d.pieslice([hx-50, hy-110, hx+50, hy-40], 180, 360, fill=(255, 59, 59, 230), outline=(60, 60, 120, 255), width=4)
    d.rectangle([hx-55, hy-70, hx+55, hy-55], fill=(255, 59, 59, 230), outline=(60, 60, 120, 255), width=4)
    d.rectangle([hx-40, hy-10, hx+40, hy+80], fill=(31, 209, 209, 220), outline=(60, 60, 120, 255), width=5)
    # star being drawn (progress)
    prog = min(1.0, max(0.0, (lt-0.8)/1.2))
    cx, cy, R = 480, 180, 90
    pts = []
    for i in range(10):
        rr = R if i % 2 == 0 else R*0.45
        a = -90 + i*36
        pts.append((cx+rr*math.cos(math.radians(a)), cy+rr*math.sin(math.radians(a))))
    # wax stroke along star outline with pressure alpha
    npts = int(len(pts)*prog)
    for i in range(npts):
        p0 = pts[i % len(pts)]; p1 = pts[(i+1) % len(pts)]
        jx = math.sin(lt*20+i)*2; jy = math.cos(lt*17+i)*2
        d.line([p0[0]+jx, p0[1]+jy, p1[0]+jx, p1[1]+jy], fill=(255, 201, 40, 200), width=10)
    if prog >= 1.0:
        d.polygon(pts, fill=(255, 201, 40, 120))
    # fuse
    draw_fuse(d, 60, TV_H-40, TV_W-60, lt/dur, t)
    return im

def game_pixel(t, lt, dur):
    # low-res indexed buffer 96x54 scaled x8
    SW, SH = 96, 54
    buf = np.zeros((SH, SW), dtype=np.uint8)
    # palette: 0 sky, 1 ground, 2 hero, 3 red cap, 4 spike, 5 white
    pal = np.array([[19, 28, 67], [62, 137, 72], [31, 209, 209], [255, 59, 59], [200, 203, 220], [255, 255, 255]], dtype=np.uint8)
    buf[:30, :] = 0
    buf[44:, :] = 1
    # spike
    buf[40:44, 60:64] = 4; buf[38:40, 61:63] = 4
    # hero jump arc
    prog = lt/dur
    hx = int(10 + prog*70)
    jump = int(14*math.sin(math.pi*min(1.0, max(0.0, (prog-0.25)/0.5)))) if 0.25 < prog < 0.75 else 0
    hy = 44 - 12 - jump
    buf[hy:hy+8, hx:hx+6] = 2
    buf[hy:hy+2, hx:hx+6] = 3  # red cap
    buf[hy+3:hy+5, hx+2:hx+4] = 5  # star
    rgb = pal[buf]
    im = Image.fromarray(rgb).resize((TV_W, TV_H), Image.NEAREST)
    d = ImageDraw.Draw(im)
    draw_fuse(d, 60, TV_H-40, TV_W-60, lt/dur, t)
    return im

def game_blueprint(t, lt, dur):
    im = Image.new('RGB', (TV_W, TV_H), (18, 78, 137))
    d = ImageDraw.Draw(im)
    # grid
    for gx in range(0, TV_W, 32):
        d.line([gx, 0, gx, TV_H], fill=(255, 255, 255, 40), width=1)
    for gy in range(0, TV_H, 32):
        d.line([0, gy, TV_W, gy], fill=(255, 255, 255, 40), width=1)
    # tower: 3 blocks stacked, 4th overshoots and topples
    prog = lt/dur
    bx, bw, bh = 300, 160, 60
    base = TV_H-80
    for i in range(3):
        d.rectangle([bx, base-(i+1)*bh, bx+bw, base-i*bh], outline=WHITE, width=4)
        d.line([bx, base-(i+1)*bh, bx+bw, base-i*bh], fill=WHITE, width=2)
    # 4th block: rises then topples (overshoot)
    if prog < 0.7:
        yy = base-4*bh - int((prog/0.7)*40)
        d.rectangle([bx, yy, bx+bw, yy+bh], outline=WHITE, width=4)
    else:
        # toppled: rotated block falling right
        fall = (prog-0.7)/0.3
        cx = bx+bw+int(fall*120); cy = base-4*bh+int(fall*80)
        d.rectangle([cx-80, cy-30, cx+80, cy+30], outline=WHITE, width=4)
        d.line([cx-80, cy, cx+80, cy], fill=WHITE, width=2)
    # hero (blueprint style: white outline, red cap + star)
    hx, hy = 140, base-90
    d.ellipse([hx-40, hy-90, hx+40, hy-10], outline=WHITE, width=4)
    d.pieslice([hx-40, hy-90, hx+40, hy-40], 180, 360, fill=RED, outline=WHITE, width=3)
    d.rectangle([hx-45, hy-55, hx+45, hy-40], fill=RED, outline=WHITE, width=3)
    d.rectangle([hx-30, hy-10, hx+30, hy+60], outline=WHITE, width=4)
    # star
    cx, cy, R = hx, hy+25, 12
    pts = [(cx+R*math.cos(math.radians(-90+i*36))*(1 if i % 2 == 0 else 0.45),
            cy+R*math.sin(math.radians(-90+i*36))*(1 if i % 2 == 0 else 0.45)) for i in range(10)]
    d.polygon(pts, fill=WHITE)
    # dimension line
    d.line([bx, base+20, bx+bw, base+20], fill=WHITE, width=2)
    d.text((bx+40, base+26), "160", font=font(28), fill=WHITE)
    draw_fuse(d, 60, TV_H-40, TV_W-60, lt/dur, t)
    return im

def game_boss(t, lt, dur):
    # mixed media: crayon ground + pixel hero + blueprint pad
    im = Image.new('RGB', (TV_W, TV_H), (250, 244, 224))
    d = ImageDraw.Draw(im, 'RGBA')
    # crayon ground
    for xx in range(0, TV_W, 6):
        d.line([xx, TV_H-70, xx+6, TV_H-70], fill=(62, 137, 72, 180), width=8)
    # blueprint pad (target)
    px, py = 520, TV_H-130
    d.rectangle([px-90, py, px+90, py+60], outline=(18, 78, 137), width=5)
    d.rectangle([px-70, py+10, px+70, py+50], outline=(18, 78, 137), width=3)
    d.ellipse([px-30, py+15, px+30, py+45], outline=RED, width=5)
    # pixel hero falling then landing
    prog = lt/dur
    if prog < 0.6:
        hy = 60 + int((prog/0.6)*180)
        hx = 200
    else:
        hy = 240; hx = 200
        # landing dust + star burst
        for i in range(8):
            a = i*45
            d.line([hx, hy+80, hx+int(40*math.cos(math.radians(a))), hy+80+int(20*math.sin(math.radians(a)))], fill=GOLD, width=4)
    # hero (pixel style: blocky, red cap + star)
    d.rectangle([hx-30, hy, hx+30, hy+60], fill=(31, 209, 209), outline=INK, width=4)
    d.rectangle([hx-30, hy, hx+30, hy+16], fill=RED, outline=INK, width=3)
    # star
    cx, cy, R = hx, hy+35, 12
    pts = [(cx+R*math.cos(math.radians(-90+i*36))*(1 if i % 2 == 0 else 0.45),
            cy+R*math.sin(math.radians(-90+i*36))*(1 if i % 2 == 0 else 0.45)) for i in range(10)]
    d.polygon(pts, fill=WHITE, outline=INK)
    d.rectangle([hx-20, hy+60, hx-4, hy+85], fill=INK); d.rectangle([hx+4, hy+60, hx+20, hy+85], fill=INK)
    draw_fuse(d, 60, TV_H-40, TV_W-60, lt/dur, t)
    return im

# ---------- audio ----------
NOTE = {'C4':261.63,'D4':293.66,'E4':329.63,'F4':349.23,'G4':392.0,'A4':440.0,'Bb4':466.16,
 'C5':523.25,'D5':587.33,'E5':659.25,'F5':698.46,'G5':783.99,'A5':880.0,'C6':1046.5,'F6':1396.9}
def pulse(freq, t, duty=0.25):
    ph = (freq*t) % 1.0
    return np.where(ph < duty, 1.0, -1.0)
def tri(freq, t):
    ph = (freq*t) % 1.0
    return 2*np.abs(2*ph-1)-1
def saw(freq, t):
    ph = (freq*t) % 1.0
    return 2*ph-1

def synth_audio():
    n = int(SR*DUR)
    t = np.arange(n)/SR
    rng = np.random.default_rng(11)
    noise = rng.standard_normal(n)
    L = np.zeros(n); R = np.zeros(n)
    # groove: kick + hats + slap bass + brass stabs, 132 BPM (beat 0.4545s)
    beat = 60/132
    bassline = ['F4','F4','Bb4','Bb4','F4','F4','C5','C5']
    for b in range(int(DUR/beat)+1):
        t0 = b*beat
        s0 = int(t0*SR)
        if s0 >= n: break
        # kick on beats
        s1 = min(n, s0+int(0.12*SR)); seg = t[s0:s1]
        L[s0:s1] += np.sin(2*np.pi*55*seg)*np.exp(-seg*30)*0.5
        R[s0:s1] += np.sin(2*np.pi*55*seg)*np.exp(-seg*30)*0.5
        # hat offbeats
        s0h = int((t0+beat/2)*SR); s1h = min(n, s0h+int(0.04*SR))
        if s1h > s0h:
            L[s0h:s1h] += noise[s0h:s1h]*0.10*np.exp(-np.arange(s1h-s0h)/SR*80)
            R[s0h:s1h] += noise[s0h:s1h]*0.10*np.exp(-np.arange(s1h-s0h)/SR*80)
        # bass (slap pluck)
        f = NOTE[bassline[b % len(bassline)]]/2
        s1b = min(n, s0+int(0.35*SR)); segb = t[s0:s1b]
        env = np.minimum(1, (segb-segb[0])*30)*np.exp(-(segb-segb[0])*8)
        L[s0:s1b] += tri(f, segb)*env*0.28; R[s0:s1b] += tri(f, segb)*env*0.28
        # brass stab on bar starts
        if b % 4 == 0:
            for f2 in [NOTE['F4'], NOTE['A4'], NOTE['C5']]:
                s1s = min(n, s0+int(0.18*SR)); segs = t[s0:s1s]
                envs = np.minimum(1, (segs-segs[0])*40)*np.exp(-(segs-segs[0])*10)
                L[s0:s1s] += saw(f2, segs)*envs*0.06; R[s0:s1s] += saw(f2, segs)*envs*0.06
    # colour instruments
    def toy_piano(t0, f):
        s0 = int(t0*SR); s1 = min(n, s0+int(0.4*SR)); seg = t[s0:s1]
        env = np.exp(-(seg-seg[0])*9)
        L[s0:s1] += (np.sin(2*np.pi*f*seg)+0.4*np.sin(2*np.pi*f*2*seg))*env*0.22
        R[s0:s1] += (np.sin(2*np.pi*f*seg)+0.4*np.sin(2*np.pi*f*2*seg))*env*0.22
    def pulse_arp(t0, f):
        s0 = int(t0*SR); s1 = min(n, s0+int(0.12*SR)); seg = t[s0:s1]
        L[s0:s1] += pulse(f, seg, 0.25)*np.exp(-(seg-seg[0])*20)*0.18
        R[s0:s1] += pulse(f, seg, 0.25)*np.exp(-(seg-seg[0])*20)*0.18
    def ratchet(t0):
        s0 = int(t0*SR); s1 = min(n, s0+int(0.05*SR))
        L[s0:s1] += noise[s0:s1]*0.25; R[s0:s1] += noise[s0:s1]*0.25
    # crayon toy piano arp (1.5-4.5)
    for i, nn in enumerate(['F5','A5','C6','F6','A5','F5']):
        toy_piano(1.7+i*0.45, NOTE[nn])
    # pixel pulse arp (5.5-8.5)
    for i in range(12):
        pulse_arp(5.7+i*0.22, NOTE[['F5','A5','C6','F6'][i % 4]])
    # blueprint ratchets (9.5-12.0)
    for i in range(10):
        ratchet(9.7+i*0.22)
    # boss full arp (12.0-15.0)
    for i in range(12):
        toy_piano(12.2+i*0.22, NOTE[['F5','A5','C6','F6'][i % 4]])
        pulse_arp(12.2+i*0.22, NOTE[['F5','A5','C6','F6'][i % 4]]*2)
    # foley
    def blip(t0, f=880, dur=0.08, vol=0.25):
        s0 = int(t0*SR); s1 = min(n, s0+int(dur*SR)); seg = t[s0:s1]
        L[s0:s1] += pulse(f, seg, 0.5)*np.minimum(1,(seg-seg[0])*80)*np.exp(-(seg-seg[0])*35)*vol
        R[s0:s1] += pulse(f, seg, 0.5)*np.minimum(1,(seg-seg[0])*80)*np.exp(-(seg-seg[0])*35)*vol
    def thud(t0, vol=0.4):
        s0 = int(t0*SR); s1 = min(n, s0+int(0.15*SR)); seg = t[s0:s1]
        L[s0:s1] += np.sin(2*np.pi*70*seg)*np.exp(-seg*25)*vol
        R[s0:s1] += np.sin(2*np.pi*70*seg)*np.exp(-seg*25)*vol
    def crack(t0):
        s0 = int(t0*SR); s1 = min(n, s0+int(0.2*SR)); seg = t[s0:s1]
        L[s0:s1] += noise[s0:s1]*np.exp(-seg*30)*0.4
        R[s0:s1] += noise[s0:s1]*np.exp(-seg*30)*0.4
    blip(0.0, 660); blip(1.5, 880, 0.12, 0.3)  # spring click / TV push
    blip(1.6, 1320, 0.06, 0.2)  # command stab
    blip(4.2, 990, 0.15, 0.3); blip(4.3, 1320, 0.2, 0.3)  # success
    blip(5.5, 880, 0.12, 0.3)
    blip(5.6, 1320, 0.06, 0.2)
    blip(8.2, 990, 0.15, 0.3); blip(8.3, 1320, 0.2, 0.3)
    blip(9.5, 880, 0.12, 0.3)
    blip(9.6, 1320, 0.06, 0.2)
    thud(11.2); crack(11.2)  # tower topple + life lost
    blip(11.3, 220, 0.3, 0.3)  # fail buzz
    # silence 11.5-12.0: heartbeat only
    i0, i1 = int(11.5*SR), int(12.0*SR)
    L[i0:i1] *= 0.05; R[i0:i1] *= 0.05
    for hb in [11.6, 11.85]:
        s0 = int(hb*SR); s1 = min(n, s0+int(0.1*SR)); seg = t[s0:s1]
        L[s0:s1] += np.sin(2*np.pi*50*seg)*np.exp(-seg*30)*0.5
        R[s0:s1] += np.sin(2*np.pi*50*seg)*np.exp(-seg*30)*0.5
    thud(12.2, 0.6)  # boss landing boom
    blip(12.3, 990, 0.15, 0.3); blip(12.4, 1320, 0.25, 0.3)
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
    gnorm = 0.89/peak
    L *= gnorm; R *= gnorm
    fl = int(0.3*SR); fade = np.linspace(1, 0, fl)
    L[-fl:] *= fade; R[-fl:] *= fade
    return L, R

def write_wav(L, R, path):
    pcm = np.stack([L, R], axis=1)
    pcm16 = (np.clip(pcm, -1, 1)*32767).astype(np.int16)
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes(pcm16.tobytes())

# ---------- timeline ----------
# (t0, t1, kind, data)
SEGMENTS = [
    (0.0, 1.5, 'home', None),
    (1.5, 4.5, 'game', ('crayon', 'DRAW!', True)),
    (4.5, 5.5, 'reels', None),
    (5.5, 8.5, 'game', ('pixel', 'JUMP!', True)),
    (8.5, 9.5, 'reels', None),
    (9.5, 12.0, 'game', ('blue', 'BUILD!', False)),
    (12.0, 15.0, 'game', ('boss', 'LAND!', True)),
]

def seg_at(t):
    for a, b, k, d in SEGMENTS:
        if a <= t < b: return a, b, k, d
    return SEGMENTS[-1]

def render_frame(idx):
    t = idx / FPS
    a, b, kind, data = seg_at(t)
    im = Image.new('RGB', (W, H), VIOLET)
    d = ImageDraw.Draw(im, 'RGBA')
    sunburst(d, W//2, H//2, 900, t)
    # stage floor
    d.rectangle([0, 820, W, H], fill=VIOLET2)
    d.rectangle([0, 820, W, 828], fill=GOLD)
    # marquee title
    d.text((W//2-260, 40), "CADET FRENZY", font=font(64), fill=GOLD, stroke_width=6, stroke_fill=INK)
    d.text((W//2-200, 110), "A MICROGAME FRENZY", font=font(36), fill=WHITE, stroke_width=4, stroke_fill=INK)
    # lives + badge
    lives = 3 if t < 11.2 else 2
    draw_lives(d, 120, 200, lives)
    toon_box(d, [W-320, 140, W-120, 220], MAGENTA)
    d.text((W-290, 165), "STAGE 1", font=font(44), fill=WHITE, stroke_width=4, stroke_fill=INK)
    # host + hero on stage
    draw_host(d, 300, 620, 1.2, t, excited=(kind == 'reels'))
    draw_hero_toon(d, W-300, 640, 1.2, t, pose='stand')
    # TV frame
    toon_box(d, [TV_X-14, TV_Y-14, TV_X+TV_W+14, TV_Y+TV_H+14], GOLD, ow=10)
    if kind == 'home':
        # push-in: scale game screen growing (simplified: dark screen + READY)
        d.rectangle([TV_X, TV_Y, TV_X+TV_W, TV_Y+TV_H], fill=(10, 5, 30))
        d.text((TV_X+TV_W//2-90, TV_Y+TV_H//2-30), "READY?", font=font(60), fill=WHITE, stroke_width=4, stroke_fill=INK)
    elif kind == 'reels':
        # slot reels: 3 strips spinning, stopping per beat
        d.rectangle([TV_X, TV_Y, TV_X+TV_W, TV_Y+TV_H], fill=(10, 5, 30))
        words = ['SPEED', 'UP', '!']
        lt = t - a
        for i, w in enumerate(words):
            stop = 0.2 + i*0.25
            yoff = 0 if lt > stop else int((stop-lt)*600)
            d.text((TV_X+120+i*200, TV_Y+150+yoff), w, font=font(110), fill=GOLD, stroke_width=8, stroke_fill=INK)
        d.text((TV_X+TV_W//2-150, TV_Y+TV_H-80), "SPEED UP!", font=font(48), fill=MAGENTA, stroke_width=5, stroke_fill=INK)
    else:
        medium, cmd, ok = data
        lt = t - a; dur = b - a
        if medium == 'crayon': g = game_crayon(t, lt, dur)
        elif medium == 'pixel': g = game_pixel(t, lt, dur)
        elif medium == 'blue': g = game_blueprint(t, lt, dur)
        else: g = game_boss(t, lt, dur)
        im.paste(g, (TV_X, TV_Y))
        d = ImageDraw.Draw(im, 'RGBA')
        # command word: slam in 3 frames, hold, shrink to corner tag
        if lt < 0.5:
            # slam scale: 1.9 -> 0.92 -> 1.0 over 3 frames (0.125s)
            fr = int(lt*FPS)
            sc = [1.9, 0.92, 1.0][min(2, fr)]
            draw_command(d, cmd, W//2, 150, sc)
        elif lt < 1.0:
            draw_command(d, cmd, W//2, 150, 1.0)
        else:
            # corner tag
            f = font(36)
            d.text((TV_X+16, TV_Y+16), cmd, font=f, fill=WHITE, stroke_width=4, stroke_fill=INK)
        # stamp at end of game
        if lt > dur-0.6:
            draw_stamp(d, W//2, H//2, ok, 1.0)
    # boss finale banner
    if t >= 13.5:
        d.text((W//2-220, 700), "STAGE CLEAR!", font=font(72), fill=GREEN, stroke_width=6, stroke_fill=INK)
    return np.array(im)

def main():
    print("Synthesizing groove + colour instruments + foley...")
    L, R = synth_audio()
    write_wav(L, R, OUT_WAV)
    print(f"Audio: {OUT_WAV} ({len(L)/SR:.2f}s)")
    subs = [(1.6, 4.5, "DRAW!"), (5.6, 8.5, "JUMP!"), (9.6, 12.0, "BUILD!"), (12.1, 15.0, "LAND!")]
    def srt_time(s):
        h = int(s//3600); m = int((s%3600)//60); sec = s%60
        return f"{h:02d}:{m:02d}:{sec:06.3f}"
    with open(OUT_SRT, 'w') as f:
        for i, (a, b, s) in enumerate(subs, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{s}\n\n")
    print(f"Subtitles: {OUT_SRT}")
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"Rendering {NFRAMES} frames 1920x1080 @ {FPS}fps...")
    cmd = [ff, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
           '-r', str(FPS), '-i', '-', '-i', str(OUT_WAV),
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2',
           '-movflags', '+faststart', '-shortest', str(OUT_MP4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    poster_frame = None
    for i in range(NFRAMES):
        frame = render_frame(i)
        if i == int(3.0*FPS): poster_frame = frame.copy()
        proc.stdin.write(frame.tobytes())
        if (i+1) % 60 == 0: print(f"  frame {i+1}/{NFRAMES}")
    proc.stdin.close()
    err = proc.stderr.read()
    proc.wait()
    if proc.returncode != 0:
        print(err.decode()[-3000:]); sys.exit(1)
    if poster_frame is not None:
        Image.fromarray(poster_frame).save(OUT_POSTER)
        print(f"Poster: {OUT_POSTER}")
    print(f"Done: {OUT_MP4} ({OUT_MP4.stat().st_size} bytes)")

if __name__ == '__main__':
    main()
