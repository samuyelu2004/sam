#!/usr/bin/env python3
"""What Happens to People Who Never Heard of Jesus? — Stained Glass film.
Python port of Lemo-Opuscar styles/stained-glass grammar: dark stone hall,
3 lancets + rose, lead cames + grisaille, sun-light band as clock, floor
projection, parchment banderole subtitles, organ/harp/bells score.
Original scenes/music from the user's script. ~3 min, 1920x1080, 24fps.
No TTS in this environment (offline voice model host blocked) — subtitles
carry the full script; score + foley synthesized.
"""
import math, subprocess, sys, wave, textwrap
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
OUT_MP4 = ROOT / "never_heard_jesus.mp4"
OUT_WAV = ROOT / "soundtrack.wav"
OUT_SRT = ROOT / "subtitles_en.srt"
OUT_POSTER = ROOT / "poster.jpg"

W, H = 1920, 1080
FPS = 24
SR = 44100
FONT_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
FONT_SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# glass palette (Chartres logic, from DEMO.md)
COBALT = (29, 58, 156); DEEPBLUE = (20, 42, 112); RUBY = (168, 16, 28)
GOLD = (220, 154, 34); EMERALD = (47, 127, 54); OLIVE = (107, 122, 34)
MURRAY = (99, 42, 99); FLESH = (210, 162, 136); WHITEGLASS = (207, 218, 198)
MAIL = (169, 183, 178); SKY = (127, 162, 207); UMBER = (122, 78, 36)
LEAD = (29, 31, 35); GRIS = (44, 26, 12)
STONE = (96, 88, 80); STONE_L = (140, 130, 118); PARCH = (232, 220, 180)

def serif(sz): return ImageFont.truetype(FONT_SERIF, sz)
def sans(sz): return ImageFont.truetype(FONT_SANS, sz)

# ---------- glass panel pre-render ----------
def lozenge_quarries(d, w, h, ground, rng):
    # jittered diamond lattice
    step = 46
    for y in range(-step, h+step, step):
        for x in range(-step, w+step, step):
            jx = rng.uniform(-4, 4); jy = rng.uniform(-4, 4)
            pts = [(x+jx, y+jy), (x+step*0.7, y+step*0.5+jy), (x+jx, y+step+jy), (x-step*0.7, y+step*0.5+jy)]
            # hue drift
            drift = rng.uniform(-12, 12)
            col = tuple(max(0, min(255, int(c+drift))) for c in ground)
            d.polygon(pts, fill=col, outline=LEAD, width=2)

def glass_figure(d, cx, cy, s, robe, pose='stand', face='calm'):
    """Simplified glass figure: robe trapezoid + head + grisaille face."""
    # robe
    d.polygon([(cx-30*s, cy+90*s), (cx+30*s, cy+90*s), (cx+18*s, cy-10*s), (cx-18*s, cy-10*s)],
              fill=robe, outline=LEAD, width=4)
    # folds (grisaille)
    for fx in (-12, 0, 12):
        d.line([cx+fx*s, cy+10*s, cx+fx*1.4*s, cy+85*s], fill=GRIS, width=2)
    # head
    hr = 20*s
    d.ellipse([cx-hr, cy-hr-28*s, cx+hr, cy+hr-28*s], fill=FLESH, outline=LEAD, width=4)
    # hair
    d.pieslice([cx-hr, cy-hr-28*s, cx+hr, cy+hr-28*s], 180, 360, fill=UMBER, outline=LEAD, width=3)
    # face: almond eyes, brow flowing into nose
    ey = cy-30*s
    d.line([cx-12*s, ey, cx-4*s, ey], fill=GRIS, width=3)
    d.line([cx+4*s, ey, cx+12*s, ey], fill=GRIS, width=3)
    d.ellipse([cx-9*s, ey+2*s, cx-5*s, ey+6*s], fill=GRIS)
    d.ellipse([cx+5*s, ey+2*s, cx+9*s, ey+6*s], fill=GRIS)
    d.line([cx, ey+6*s, cx, ey+14*s], fill=GRIS, width=2)
    if face == 'calm':
        d.arc([cx-6*s, ey+14*s, cx+6*s, ey+22*s], 0, 180, fill=GRIS, width=2)
    elif face == 'bowed':
        d.arc([cx-6*s, ey+18*s, cx+6*s, ey+24*s], 180, 360, fill=GRIS, width=2)
    # arms by pose
    if pose == 'pray':
        d.line([cx-16*s, cy+10*s, cx-4*s, cy+30*s], fill=GRIS, width=3)
        d.line([cx+16*s, cy+10*s, cx+4*s, cy+30*s], fill=GRIS, width=3)
    elif pose == 'point':
        d.line([cx+16*s, cy+10*s, cx+44*s, cy-6*s], fill=GRIS, width=3)
    elif pose == 'hold':
        d.line([cx-16*s, cy+10*s, cx-20*s, cy+40*s], fill=GRIS, width=3)
        d.line([cx+16*s, cy+10*s, cx+20*s, cy+40*s], fill=GRIS, width=3)

def panel_cornelius():
    w, h = 420, 640
    im = Image.new('RGB', (w, h), COBALT)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(5)
    lozenge_quarries(d, w, h, COBALT, rng)
    # house
    d.rectangle([40, 380, 220, 560], fill=UMBER, outline=LEAD, width=5)
    d.polygon([(30, 380), (130, 300), (230, 380)], fill=RUBY, outline=LEAD, width=5)
    d.rectangle([110, 460, 160, 560], fill=LEAD)
    # praying man (Cornelius)
    glass_figure(d, 300, 380, 1.6, MURRAY, 'pray', 'bowed')
    # lamp (story light — gold, no glass uses it)
    d.ellipse([330, 250, 370, 290], fill=GOLD, outline=LEAD, width=3)
    d.ellipse([342, 262, 358, 278], fill=(255, 240, 180))
    # border: ruby band + pearls
    d.rectangle([0, 0, w, 18], fill=RUBY, outline=LEAD, width=3)
    d.rectangle([0, h-18, w, h], fill=RUBY, outline=LEAD, width=3)
    for x in range(20, w, 40):
        d.ellipse([x, 4, x+10, 14], fill=GOLD, outline=LEAD, width=2)
        d.ellipse([x, h-14, x+10, h-4], fill=GOLD, outline=LEAD, width=2)
    return im

def panel_peter():
    w, h = 420, 640
    im = Image.new('RGB', (w, h), DEEPBLUE)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(9)
    lozenge_quarries(d, w, h, DEEPBLUE, rng)
    # sea (Joppa) — sky glass band
    d.rectangle([0, 80, w, 200], fill=SKY, outline=LEAD, width=3)
    for x in range(10, w, 50):
        d.arc([x, 120, x+40, 160], 0, 180, fill=WHITEGLASS, width=3)
    # angel (light figure, white glass)
    ax, ay = 130, 300
    d.polygon([(ax-50, ay+160), (ax+50, ay+160), (ax+30, ay-20), (ax-30, ay-20)], fill=WHITEGLASS, outline=LEAD, width=4)
    d.ellipse([ax-28, ay-70, ax+28, ay-14], fill=FLESH, outline=LEAD, width=4)
    # wings
    d.polygon([(ax-30, ay+10), (ax-110, ay-60), (ax-90, ay+60)], fill=SKY, outline=LEAD, width=3)
    d.polygon([(ax+30, ay+10), (ax+110, ay-60), (ax+90, ay+60)], fill=SKY, outline=LEAD, width=3)
    # halo ring (story light)
    d.ellipse([ax-40, ay-90, ax+40, ay-10], outline=GOLD, width=6)
    # Peter with scroll
    glass_figure(d, 300, 320, 1.6, EMERALD, 'hold', 'calm')
    d.rectangle([270, 420, 340, 470], fill=PARCH, outline=LEAD, width=3)
    d.text((282, 432), "God is no", font=serif(20), fill=GRIS)
    d.text((282, 452), "respecter", font=serif(20), fill=GRIS)
    d.rectangle([0, 0, w, 18], fill=RUBY, outline=LEAD, width=3)
    d.rectangle([0, h-18, w, h], fill=RUBY, outline=LEAD, width=3)
    for x in range(20, w, 40):
        d.ellipse([x, 4, x+10, 14], fill=GOLD, outline=LEAD, width=2)
        d.ellipse([x, h-14, x+10, h-4], fill=GOLD, outline=LEAD, width=2)
    return im

def panel_athens():
    w, h = 420, 640
    im = Image.new('RGB', (w, h), COBALT)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(13)
    lozenge_quarries(d, w, h, COBALT, rng)
    # creation: sun + stars
    d.ellipse([150, 60, 270, 180], fill=GOLD, outline=LEAD, width=5)
    d.ellipse([180, 90, 240, 150], fill=(255, 240, 180))
    for i in range(8):
        a = i*45
        x1 = 210+80*math.cos(math.radians(a)); y1 = 120+80*math.sin(math.radians(a))
        x2 = 210+110*math.cos(math.radians(a)); y2 = 120+110*math.sin(math.radians(a))
        d.line([x1, y1, x2, y2], fill=GOLD, width=4)
    for i in range(10):
        sx = rng.uniform(20, w-20); sy = rng.uniform(220, 320)
        d.ellipse([sx-3, sy-3, sx+3, sy+3], fill=WHITEGLASS, outline=LEAD, width=1)
    # heart with law
    d.ellipse([150, 340, 270, 460], fill=RUBY, outline=LEAD, width=5)
    d.text((175, 380), "LAW", font=serif(36), fill=PARCH)
    # altar
    d.rectangle([90, 480, 330, 580], fill=MAIL, outline=LEAD, width=5)
    d.rectangle([110, 460, 310, 480], fill=MAIL, outline=LEAD, width=4)
    d.text((120, 500), "TO THE", font=serif(30), fill=GRIS)
    d.text((105, 532), "UNKNOWN GOD", font=serif(30), fill=GRIS)
    d.rectangle([0, 0, w, 18], fill=RUBY, outline=LEAD, width=3)
    d.rectangle([0, h-18, w, h], fill=RUBY, outline=LEAD, width=3)
    for x in range(20, w, 40):
        d.ellipse([x, 4, x+10, 14], fill=GOLD, outline=LEAD, width=2)
        d.ellipse([x, h-14, x+10, h-4], fill=GOLD, outline=LEAD, width=2)
    return im

def panel_sodom():
    w, h = 420, 640
    im = Image.new('RGB', (w, h), MURRAY)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(17)
    lozenge_quarries(d, w, h, MURRAY, rng)
    # scales (fair judge)
    d.line([210, 80, 210, 220], fill=GOLD, width=8)
    d.line([110, 110, 310, 110], fill=GOLD, width=6)
    d.polygon([(110, 110), (70, 200), (150, 200)], fill=MAIL, outline=LEAD, width=3)
    d.polygon([(310, 110), (270, 200), (350, 200)], fill=MAIL, outline=LEAD, width=3)
    d.ellipse([190, 60, 230, 100], fill=GOLD, outline=LEAD, width=3)
    # city towers
    for tx, th in [(60, 180), (150, 240), (240, 200), (320, 150)]:
        d.rectangle([tx, 480-th, tx+60, 480], fill=DEEPBLUE, outline=LEAD, width=4)
        for wy in range(480-th+20, 460, 40):
            d.rectangle([tx+20, wy, tx+40, wy+20], fill=GOLD, outline=LEAD, width=2)
    # "10" tablet
    d.rectangle([150, 500, 270, 590], fill=PARCH, outline=LEAD, width=4)
    d.text((185, 520), "10", font=serif(48), fill=GRIS)
    d.rectangle([0, 0, w, 18], fill=RUBY, outline=LEAD, width=3)
    d.rectangle([0, h-18, w, h], fill=RUBY, outline=LEAD, width=3)
    for x in range(20, w, 40):
        d.ellipse([x, 4, x+10, 14], fill=GOLD, outline=LEAD, width=2)
        d.ellipse([x, h-14, x+10, h-4], fill=GOLD, outline=LEAD, width=2)
    return im

def panel_rose():
    w, h = 420, 420
    im = Image.new('RGB', (w, h), COBALT)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(21)
    lozenge_quarries(d, w, h, COBALT, rng)
    cx, cy = w//2, h//2
    d.ellipse([cx-70, cy-70, cx+70, cy+70], fill=GOLD, outline=LEAD, width=5)
    d.ellipse([cx-40, cy-40, cx+40, cy+40], fill=(255, 240, 180), outline=LEAD, width=3)
    for i in range(8):
        a = i*45
        x1 = cx+80*math.cos(math.radians(a)); y1 = cy+80*math.sin(math.radians(a))
        x2 = cx+160*math.cos(math.radians(a)); y2 = cy+160*math.sin(math.radians(a))
        col = RUBY if i % 2 == 0 else DEEPBLUE
        d.line([x1, y1, x2, y2], fill=col, width=28)
        d.line([x1, y1, x2, y2], fill=LEAD, width=2)
    return im

PANELS = None
def get_panels():
    global PANELS
    if PANELS is None:
        PANELS = [panel_cornelius(), panel_peter(), panel_athens(), panel_sodom(), panel_rose()]
    return PANELS

# ---------- subtitles (banderole) ----------
LINES = [
    (2.0, 14.0, "What happens to people who never heard of Jesus? If Jesus is the only way to the Father, what about a man born in a remote village who died without ever hearing his name?"),
    (15.0, 32.0, "People ask this in our comments all the time, so let's allow the Bible to answer it. In Caesarea, there lived a Roman officer named Cornelius, a Gentile who had never heard the gospel preached."),
    (33.0, 46.0, "Yet the Bible says he feared God with all his house, gave much to the poor, and prayed to God continually."),
    (47.0, 62.0, "One afternoon, an angel told him to send for a man called Peter, who was lodging by the sea in Joppa."),
    (63.0, 78.0, "When Peter walked into that house, he said, \"God is no respecter of persons, but in every nation he that feareth him is accepted with him.\""),
    (79.0, 90.0, "So the first answer is this. God saw a man reaching for him with the little light he had, and he sent the gospel straight to his door."),
    (91.0, 106.0, "The second answer is that no one is born without any light at all. Paul writes that God's eternal power is clearly seen in creation, and that his law is written on the hearts of people who never had the scriptures."),
    (107.0, 118.0, "When Paul walked through Athens, he found an altar carved with the words, \"To the unknown God,\" built by people reaching for a God they couldn't name."),
    (119.0, 132.0, "The third answer is that God will judge every person fairly by what they were given. Jesus said, \"Unto whomsoever much is given, of him shall be much required.\""),
    (133.0, 148.0, "Centuries earlier, Abraham pleaded with God for the city of Sodom and asked, \"Shall not the judge of all the earth do right?\" God agreed to spare the whole city if even 10 righteous people could be found inside it."),
    (149.0, 166.0, "Christians still disagree on exactly how God deals with those who never heard. Some believe a person must hear of Jesus and trust him in this life, while others believe Christ can save people who never learned his name. But every one of those views agrees that no one is saved except through Jesus."),
    (167.0, 174.0, "Then Paul asks a question that puts the weight back on our shoulders."),
]
DUR = 178.0
NFRAMES = int(FPS * DUR)

def draw_banderole(d, text, t_in, t_out, t):
    # unfurl from centre; text fades in at >=75% open
    total = t_out - t_in
    open_p = min(1.0, (t - t_in) / 0.8)
    if open_p <= 0: return
    cx = W//2; cy = H - 120
    bw = int(1500 * open_p); bh = 90
    x0, y0 = cx-bw//2, cy-bh//2
    # parchment ribbon with curled ends + sag
    d.rectangle([x0, y0, x0+bw, y0+bh], fill=PARCH, outline=GRIS, width=3)
    # curls
    d.ellipse([x0-30, y0+10, x0+10, y0+bh-10], fill=PARCH, outline=GRIS, width=3)
    d.ellipse([x0+bw-10, y0+10, x0+bw+30, y0+bh-10], fill=PARCH, outline=GRIS, width=3)
    d.line([x0, y0+bh, x0+bw, y0+bh], fill=GRIS, width=2)
    if open_p >= 0.75:
        f = serif(34)
        # wrap text
        words = text.split()
        lines = []; cur = ""
        for w_ in words:
            test = (cur + " " + w_).strip()
            if d.textlength(test, font=f) > bw-80 and cur:
                lines.append(cur); cur = w_
            else: cur = test
        if cur: lines.append(cur)
        ty = cy - (len(lines)*42)//2
        for ln in lines:
            lw = d.textlength(ln, font=f)
            d.text((cx-lw/2, ty), ln, font=f, fill=(40, 26, 12))
            ty += 42

# ---------- audio ----------
def bell_partial(freq, t):
    # inharmonic partials 1 : 2.32 : 4.25 : 6.63 : 9.38
    out = np.zeros_like(t)
    for r, g in [(1, 1.0), (2.32, 0.6), (4.25, 0.35), (6.63, 0.2), (9.38, 0.12)]:
        out += g*np.sin(2*np.pi*freq*r*t)*np.exp(-t*(2+r))
    return out

def synth_audio():
    n = int(SR*DUR)
    t = np.arange(n)/SR
    rng = np.random.default_rng(4)
    noise = rng.standard_normal(n)
    L = np.zeros(n); R = np.zeros(n)
    # hall ambience (low filtered noise)
    amb = np.zeros(n); a = 0.02
    for i in range(1, n): amb[i] = amb[i-1] + a*(noise[i]-amb[i-1])
    L += amb*0.05; R += amb*0.05
    # organ drone (D Dorian): D2 + D3 + A3, slow attack
    def organ(t0, t1, freqs, vol=0.12):
        s0, s1 = int(t0*SR), int(t1*SR)
        seg = t[s0:s1]
        env = np.minimum(1, (seg-seg[0])*0.5) * np.minimum(1, (seg[-1]-seg)*0.5)
        sig = np.zeros_like(seg)
        for f in freqs:
            sig += np.sin(2*np.pi*f*seg) + 0.4*np.sin(2*np.pi*f*2*seg) + 0.15*np.sin(2*np.pi*f*3*seg)
        L[s0:s1] += sig*env*vol; R[s0:s1] += sig*env*vol
    organ(2, 90, [73.42, 146.83, 220.0], 0.10)   # D2 D3 A3
    organ(91, 148, [73.42, 146.83, 174.61], 0.10)  # D2 D3 F3 (dusk)
    organ(149, 174, [73.42, 146.83, 220.0, 293.66], 0.12)  # full
    # harp arpeggio on pane wakings (one note = the light)
    def harp(t0, f):
        s0 = int(t0*SR); s1 = min(n, s0+int(1.2*SR)); seg = t[s0:s1]
        env = np.exp(-(seg-seg[0])*3)
        sig = np.sin(2*np.pi*f*seg)*env + 0.5*np.sin(2*np.pi*f*2*seg)*env
        L[s0:s1] += sig*0.20; R[s0:s1] += sig*0.20
    for t0, f in [(15, 587.33), (33, 659.25), (47, 698.46), (63, 783.99), (79, 880.0),
                  (91, 783.99), (107, 880.0), (119, 698.46), (133, 587.33), (149, 783.99)]:
        harp(t0, f)
    # bells on key lines
    def bell(t0, f=293.66, vol=0.30):
        s0 = int(t0*SR); s1 = min(n, s0+int(3.0*SR)); seg = t[s0:s1]
        sig = bell_partial(f, seg)
        L[s0:s1] += sig*vol; R[s0:s1] += sig*vol
    bell(63, 293.66); bell(79, 349.23); bell(149, 293.66)
    # glass tinkles (struck glass)
    def tink(t0, f=1174.66, vol=0.15):
        s0 = int(t0*SR); s1 = min(n, s0+int(0.8*SR)); seg = t[s0:s1]
        sig = bell_partial(f, seg)*np.exp(-seg*8)
        L[s0:s1] += sig*vol; R[s0:s1] += sig*vol
    for t0 in [2.0, 15.0, 47.0, 91.0, 119.0, 149.0]:
        tink(t0)
    # crack at Sodom (snap + thump + tinkles)
    s0 = int(133*SR); s1 = min(n, s0+int(0.5*SR)); seg = t[s0:s1]
    L[s0:s1] += noise[s0:s1]*np.exp(-seg*20)*0.4; R[s0:s1] += noise[s0:s1]*np.exp(-seg*20)*0.4
    # final bell (long reverb)
    bell(167, 293.66, 0.35)
    # normalize
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
    gnorm = 0.89/peak
    L *= gnorm; R *= gnorm
    fl = int(1.0*SR); fade = np.linspace(1, 0, fl)
    L[-fl:] *= fade; R[-fl:] *= fade
    return L, R

def write_wav(L, R, path):
    pcm = np.stack([L, R], axis=1)
    pcm16 = (np.clip(pcm, -1, 1)*32767).astype(np.int16)
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes(pcm16.tobytes())

# ---------- render ----------
def render_frame(idx):
    t = idx / FPS
    panels = get_panels()
    im = Image.new('RGB', (W, H), (30, 26, 24))
    d = ImageDraw.Draw(im, 'RGBA')
    # stone wall (ashlar courses)
    d.rectangle([0, 0, W, H], fill=STONE)
    for y in range(0, H, 86):
        d.line([0, y, W, y], fill=(70, 62, 54), width=3)
        off = 60 if (y//86) % 2 else 0
        for x in range(off, W, 240):
            d.line([x, y, x, y+86], fill=(70, 62, 54), width=3)
    # window opening (splayed embrasure)
    wx0, wy0, wx1, wy1 = 260, 60, 1660, 820
    d.rectangle([wx0-30, wy0-30, wx1+30, wy1+30], fill=STONE_L, outline=(60, 52, 44), width=6)
    # light band position: sun moves left->right across film (dawn->dusk)
    band_x = wx0 + (wx1-wx0) * min(1.0, t/DUR)
    # lancets: 3 panels + rose above centre
    lancet_w, lancet_h = 420, 640
    xs = [wx0+40, wx0+490, wx0+940]
    ly = wy0+120
    # per-lancet light: bright when band is over it
    for i, (px, panel) in enumerate(zip(xs, panels[:4])):
        # panel 0..3: Cornelius, Peter, Athens, Sodom (4 lancets? we have 4 panels, 3 slots + reuse)
        pass
    # Use 3 lancets: Cornelius(+Peter combined timing), Athens, Sodom; rose on top
    lancet_panels = [panels[0], panels[2], panels[3]]
    # Peter panel flashes during Peter lines (63-78s) over lancet 1
    if 63 <= t < 79:
        lancet_panels[0] = panels[1]
    for i, (px, panel) in enumerate(zip(xs, lancet_panels)):
        # brightness: band proximity
        cx = px + lancet_w//2
        dist = abs(cx - band_x)
        lit = max(0.25, 1.0 - dist/900.0)
        # sun colour by time: dawn blue-white -> noon white -> dusk orange
        p = t/DUR
        if p < 0.5:
            tint = (0.85+0.15*(p*2), 0.9, 1.0)
        else:
            q = (p-0.5)*2
            tint = (1.0, 0.9-0.3*q, 1.0-0.6*q)
        bright = panel.point(lambda v: min(255, int(v*lit*2.2*tint[0])))
        # tint channels
        arr = np.array(bright).astype(np.float32)
        arr[..., 0] *= tint[0]; arr[..., 1] *= tint[1]; arr[..., 2] *= tint[2]
        bright = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        # lancet arch mask (rounded top)
        mask = Image.new('L', (lancet_w, lancet_h), 0)
        md = ImageDraw.Draw(mask)
        md.rectangle([0, 100, lancet_w, lancet_h], fill=255)
        md.pieslice([0, 0, lancet_w, 200], 180, 360, fill=255)
        im.paste(bright, (px, ly), mask)
        d = ImageDraw.Draw(im, 'RGBA')
        # lead frame
        d.rectangle([px, ly+100, px+lancet_w, ly+lancet_h], outline=LEAD, width=8)
        d.pieslice([px, ly, px+lancet_w, ly+200], 180, 360, outline=LEAD, width=8)
        # iron saddle bar
        d.line([px+lancet_w//2, ly, px+lancet_w//2, ly+lancet_h], fill=(20, 20, 24), width=6)
    # rose (sun clock)
    rose = panels[4].resize((300, 300))
    rx, ry = W//2-150, wy0-10
    # rose brightness follows sun height (bright midday)
    rose_lit = 0.3 + 0.7*math.sin(math.pi*min(1.0, t/DUR))
    rose_b = rose.point(lambda v: min(255, int(v*rose_lit*2.0)))
    im.paste(rose_b, (rx, ry))
    d = ImageDraw.Draw(im, 'RGBA')
    d.ellipse([rx, ry, rx+300, ry+300], outline=LEAD, width=8)
    # floor + projection patch
    d.rectangle([0, 820, W, H], fill=(70, 62, 54))
    for y in range(820, H, 60):
        d.line([0, y, W, y], fill=(55, 48, 42), width=3)
    # coloured patch (blurred, desaturated)
    patch = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(patch)
    pd.ellipse([band_x-300, 860, band_x+300, 1060], fill=(29, 58, 156, 90))
    pd.ellipse([band_x-150, 880, band_x+150, 1040], fill=(168, 16, 28, 70))
    patch = patch.filter(ImageFilter.GaussianBlur(30))
    im = Image.alpha_composite(im.convert('RGBA'), patch).convert('RGB')
    d = ImageDraw.Draw(im, 'RGBA')
    # light shafts (additive, dust)
    for i in range(5):
        sx = wx0 + i*280
        d.polygon([(sx, 100), (sx+120, 100), (sx+300, 900), (sx+80, 900)], fill=(255, 240, 200, 18))
    rng = np.random.default_rng(int(t*8))
    for i in range(30):
        dx = rng.uniform(0, W); dy = rng.uniform(0, H)
        d.ellipse([dx, dy, dx+3, dy+3], fill=(255, 240, 200, 60))
    # carved title on string course
    d.text((W//2-330, 860), "WHAT HAPPENS TO PEOPLE WHO NEVER HEARD?", font=serif(30), fill=(50, 42, 34))
    # subtitle banderole
    for a, b, s in LINES:
        if a <= t < b:
            draw_banderole(d, s, a, b, t)
            break
    # hook title (first 2s)
    if t < 2.0:
        d.text((W//2-400, 400), "WHAT HAPPENS TO PEOPLE", font=serif(64), fill=PARCH, stroke_width=2, stroke_fill=GRIS)
        d.text((W//2-400, 480), "WHO NEVER HEARD OF JESUS?", font=serif(64), fill=PARCH, stroke_width=2, stroke_fill=GRIS)
    return np.array(im)

def main():
    print("Pre-rendering glass panels...")
    get_panels()
    print("Synthesizing organ/harp/bells score...")
    L, R = synth_audio()
    write_wav(L, R, OUT_WAV)
    print(f"Audio: {OUT_WAV} ({len(L)/SR:.2f}s)")
    def srt_time(s):
        h = int(s//3600); m = int((s%3600)//60); sec = s%60
        return f"{h:02d}:{m:02d}:{sec:06.3f}"
    with open(OUT_SRT, 'w') as f:
        for i, (a, b, s) in enumerate(LINES, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{s}\n\n")
    print(f"Subtitles: {OUT_SRT}")
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"Rendering {NFRAMES} frames 1920x1080 @ {FPS}fps...")
    cmd = [ff, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
           '-r', str(FPS), '-i', '-', '-i', str(OUT_WAV),
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2',
           '-movflags', '+faststart', '-shortest', str(OUT_MP4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    poster_frame = None
    for i in range(NFRAMES):
        frame = render_frame(i)
        if i == int(70*FPS): poster_frame = frame.copy()
        proc.stdin.write(frame.tobytes())
        if (i+1) % 240 == 0: print(f"  frame {i+1}/{NFRAMES}")
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
