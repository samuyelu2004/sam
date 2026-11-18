#!/usr/bin/env python3
"""Stained Glass v2 — fast-cut explainer: new glass scene every ~2s.
Same look/score as v1; picture re-cut to 2s beats with camera moves.
Reuses v1 panels + audio. 1920x1080, 24fps, 178s.
"""
import math, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg
sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_glass as rg

ROOT = Path(__file__).resolve().parent
OUT_MP4 = ROOT / "never_heard_jesus_v2.mp4"
OUT_WAV = ROOT / "soundtrack.wav"  # reused from v1
OUT_SRT = ROOT / "subtitles_en.srt"
OUT_POSTER = ROOT / "poster_v2.jpg"
W, H, FPS = 1920, 1080, 24
DUR = 178.0
NFRAMES = int(FPS * DUR)
COBALT, DEEPBLUE, RUBY, GOLD = rg.COBALT, rg.DEEPBLUE, rg.RUBY, rg.GOLD
EMERALD, MURRAY, FLESH, WHITEGLASS = rg.EMERALD, rg.MURRAY, rg.FLESH, rg.WHITEGLASS
MAIL, SKY, UMBER, LEAD, GRIS, STONE, STONE_L, PARCH = rg.MAIL, rg.SKY, rg.UMBER, rg.LEAD, rg.GRIS, rg.STONE, rg.STONE_L, rg.PARCH
serif, sans = rg.serif, rg.sans

def base_panel(w, h, ground, seed):
    im = Image.new('RGB', (w, h), ground)
    d = ImageDraw.Draw(im)
    rg.lozenge_quarries(d, w, h, ground, np.random.default_rng(seed))
    d.rectangle([0, 0, w, 18], fill=RUBY, outline=LEAD, width=3)
    d.rectangle([0, h-18, w, h], fill=RUBY, outline=LEAD, width=3)
    for x in range(20, w, 40):
        d.ellipse([x, 4, x+10, 14], fill=GOLD, outline=LEAD, width=2)
        d.ellipse([x, h-14, x+10, h-4], fill=GOLD, outline=LEAD, width=2)
    return im, d

def p_village():
    im, d = base_panel(420, 640, COBALT, 31)
    d.rectangle([120, 380, 300, 560], fill=UMBER, outline=LEAD, width=5)
    d.polygon([(110, 380), (210, 290), (310, 380)], fill=RUBY, outline=LEAD, width=5)
    d.ellipse([150, 80, 270, 200], fill=GOLD, outline=LEAD, width=5)
    d.ellipse([180, 110, 240, 170], fill=(255, 240, 180))
    rg.glass_figure(d, 210, 420, 1.2, MURRAY, 'stand', 'calm')
    return im

def p_dying():
    im, d = base_panel(420, 640, DEEPBLUE, 33)
    # lying figure
    d.polygon([(80, 480), (340, 480), (320, 430), (100, 430)], fill=MURRAY, outline=LEAD, width=4)
    d.ellipse([300, 410, 360, 470], fill=FLESH, outline=LEAD, width=4)
    d.pieslice([300, 410, 360, 470], 180, 360, fill=UMBER, outline=LEAD, width=3)
    # fading light (small, dim)
    d.ellipse([180, 200, 240, 260], fill=GOLD, outline=LEAD, width=4)
    d.ellipse([195, 215, 225, 245], fill=(255, 240, 180))
    return im

def p_question():
    im, d = base_panel(420, 640, COBALT, 35)
    d.ellipse([110, 180, 310, 380], fill=WHITEGLASS, outline=LEAD, width=5)
    d.text((175, 210), "?", font=serif(120), fill=GRIS)
    return im

def p_alms():
    im, d = base_panel(420, 640, COBALT, 37)
    # hands giving (simplified: two sleeves + coins)
    d.polygon([(40, 300), (180, 300), (160, 420), (40, 420)], fill=EMERALD, outline=LEAD, width=4)
    d.polygon([(380, 300), (240, 300), (260, 420), (380, 420)], fill=EMERALD, outline=LEAD, width=4)
    for i, (cx, cy) in enumerate([(190, 380), (210, 370), (230, 380), (200, 395), (220, 395)]):
        d.ellipse([cx-14, cy-14, cx+14, cy+14], fill=GOLD, outline=LEAD, width=3)
    d.text((150, 460), "POOR", font=serif(40), fill=PARCH)
    return im

def p_sea():
    im, d = base_panel(420, 640, SKY, 39)
    d.rectangle([0, 0, 420, 300], fill=COBALT, outline=LEAD, width=3)
    for x in range(10, 420, 60):
        d.arc([x, 280, x+50, 320], 0, 180, fill=WHITEGLASS, width=4)
    # boat + shore house
    d.polygon([(150, 420), (270, 420), (250, 470), (170, 470)], fill=UMBER, outline=LEAD, width=4)
    d.rectangle([60, 500, 180, 600], fill=UMBER, outline=LEAD, width=4)
    d.polygon([(50, 500), (120, 440), (190, 500)], fill=RUBY, outline=LEAD, width=4)
    return im

def p_door():
    im, d = base_panel(420, 640, COBALT, 41)
    d.rectangle([110, 120, 310, 580], fill=LEAD)
    d.polygon([(130, 140), (200, 140), (200, 560), (130, 560)], fill=GOLD, outline=LEAD, width=4)
    d.polygon([(220, 140), (290, 140), (290, 560), (220, 560)], fill=(255, 240, 180), outline=LEAD, width=4)
    rg.glass_figure(d, 210, 380, 1.3, EMERALD, 'point', 'calm')
    return im

def p_stars():
    im, d = base_panel(420, 640, DEEPBLUE, 43)
    rng = np.random.default_rng(43)
    for i in range(30):
        sx = rng.uniform(20, 400); sy = rng.uniform(40, 400)
        d.ellipse([sx-4, sy-4, sx+4, sy+4], fill=WHITEGLASS, outline=LEAD, width=1)
    d.ellipse([140, 420, 280, 560], fill=GOLD, outline=LEAD, width=5)
    d.ellipse([170, 450, 250, 530], fill=(255, 240, 180))
    return im

def p_conscience():
    im, d = base_panel(420, 640, RUBY, 45)
    d.ellipse([110, 180, 310, 380], fill=RUBY, outline=LEAD, width=5)
    d.rectangle([150, 230, 270, 330], fill=PARCH, outline=LEAD, width=3)
    d.text((165, 250), "LAW", font=serif(36), fill=GRIS)
    d.line([170, 300, 250, 300], fill=GRIS, width=3)
    d.line([170, 315, 250, 315], fill=GRIS, width=3)
    return im

def p_columns():
    im, d = base_panel(420, 640, MAIL, 47)
    for x in [60, 160, 260]:
        d.rectangle([x, 120, x+50, 520], fill=WHITEGLASS, outline=LEAD, width=4)
        d.rectangle([x-10, 100, x+60, 120], fill=MAIL, outline=LEAD, width=3)
        d.rectangle([x-10, 520, x+60, 540], fill=MAIL, outline=LEAD, width=3)
    rg.glass_figure(d, 210, 400, 1.2, MURRAY, 'point', 'calm')
    return im

def p_twoviews():
    im, d = base_panel(420, 640, COBALT, 49)
    rg.glass_figure(d, 130, 350, 1.4, EMERALD, 'stand', 'calm')
    rg.glass_figure(d, 290, 350, 1.4, MURRAY, 'stand', 'calm')
    d.text((150, 520), "VIEWS", font=serif(40), fill=PARCH)
    return im

def p_floor():
    im, d = base_panel(420, 640, STONE, 51)
    for y in range(0, 640, 80):
        d.line([0, y, 420, y], fill=(70, 62, 54), width=3)
    d.ellipse([60, 200, 360, 440], fill=COBALT, outline=LEAD, width=4)
    d.ellipse([140, 260, 280, 380], fill=RUBY, outline=LEAD, width=3)
    d.ellipse([180, 290, 240, 350], fill=GOLD, outline=LEAD, width=3)
    return im

PANELS = {}
def get_panels():
    if not PANELS:
        v1 = rg.get_panels()
        PANELS.update({
            'cornelius': v1[0], 'peter': v1[1], 'athens': v1[2], 'sodom': v1[3], 'rose': v1[4],
            'village': p_village(), 'dying': p_dying(), 'question': p_question(),
            'alms': p_alms(), 'sea': p_sea(), 'door': p_door(), 'stars': p_stars(),
            'conscience': p_conscience(), 'columns': p_columns(), 'twoviews': p_twoviews(),
            'floor': p_floor(),
        })
    return PANELS

# scene list: auto-generated 2s scenes synced to v1 narration timings
LINE_PANELS = [
    ['rose', 'village', 'dying', 'question', 'village', 'dying'],
    ['cornelius', 'cornelius', 'village', 'cornelius', 'cornelius', 'cornelius', 'cornelius', 'cornelius'],
    ['cornelius', 'alms', 'alms', 'cornelius', 'cornelius', 'cornelius'],
    ['peter', 'peter', 'sea', 'sea', 'door', 'door', 'door'],
    ['door', 'peter', 'peter', 'peter', 'peter', 'peter', 'peter'],
    ['door', 'cornelius', 'cornelius', 'door', 'door'],
    ['athens', 'stars', 'stars', 'athens', 'conscience', 'conscience', 'conscience'],
    ['columns', 'columns', 'athens', 'athens', 'athens'],
    ['sodom', 'sodom', 'sodom', 'sodom', 'sodom', 'sodom'],
    ['sodom', 'sodom', 'sodom', 'sodom', 'sodom', 'sodom', 'sodom'],
    ['twoviews', 'twoviews', 'twoviews', 'twoviews', 'twoviews', 'twoviews', 'rose', 'rose'],
    ['floor', 'floor', 'floor'],
]
MOVES = ['push', 'truck', 'lock', 'pull']
def build_scenes():
    scenes = []
    for li, (a, b, text) in enumerate(rg.LINES):
        dur = b - a
        n = max(1, int(round(dur / 2.0)))
        words = text.split()
        panels = LINE_PANELS[li % len(LINE_PANELS)]
        for k in range(n):
            t0 = a + dur * k / n
            t1 = a + dur * (k+1) / n
            w0 = int(len(words) * k / n); w1 = int(len(words) * (k+1) / n)
            chunk = ' '.join(words[w0:w1]) if w1 > w0 else words[min(w0, len(words)-1)]
            scenes.append((t0, t1, panels[k % len(panels)], MOVES[k % len(MOVES)], chunk))
    return scenes
SCENES = build_scenes()

def scene_at(t):
    if t < SCENES[0][0]: return SCENES[0]
    for a, b, p, m, tx in SCENES:
        if a <= t < b: return a, b, p, m, tx
    return SCENES[-1]

def crop_for_move(panel, move, prog):
    w, h = panel.size
    if move == 'push':
        s = 1.0 + 0.35*prog
        cw, ch = int(w/s), int(h/s)
        x0, y0 = (w-cw)//2, (h-ch)//2
    elif move == 'pull':
        s = 1.35 - 0.35*prog
        cw, ch = int(w/s), int(h/s)
        x0, y0 = (w-cw)//2, (h-ch)//2
    elif move == 'truck':
        cw, ch = w, h
        x0 = int((w-cw) * prog) if w > cw else 0
        y0 = 0
        # truck: pan across by cropping narrower
        cw = int(w*0.75)
        x0 = int((w-cw)*prog)
    else:
        cw, ch, x0, y0 = w, h, 0, 0
    return panel.crop((x0, y0, x0+cw, y0+ch))

def draw_banderole_short(d, text, prog):
    cx, cy = W//2, H-110
    bw, bh = 1400, 80
    x0, y0 = cx-bw//2, cy-bh//2
    d.rectangle([x0, y0, x0+bw, y0+bh], fill=PARCH, outline=GRIS, width=3)
    d.ellipse([x0-28, y0+8, x0+8, y0+bh-8], fill=PARCH, outline=GRIS, width=3)
    d.ellipse([x0+bw-8, y0+8, x0+bw+28, y0+bh-8], fill=PARCH, outline=GRIS, width=3)
    f = serif(36)
    lw = d.textlength(text, font=f)
    d.text((cx-lw/2, cy-22), text, font=f, fill=(40, 26, 12))

def render_frame(idx):
    t = idx / FPS
    panels = get_panels()
    a, b, pname, move, text = scene_at(t)
    prog = min(1.0, max(0.0, (t-a)/max(0.001, (b-a))))
    im = Image.new('RGB', (W, H), (30, 26, 24))
    d = ImageDraw.Draw(im, 'RGBA')
    d.rectangle([0, 0, W, H], fill=STONE)
    for y in range(0, H, 86):
        d.line([0, y, W, y], fill=(70, 62, 54), width=3)
    wx0, wy0, wx1, wy1 = 260, 60, 1660, 820
    d.rectangle([wx0-30, wy0-30, wx1+30, wy1+30], fill=STONE_L, outline=(60, 52, 44), width=6)
    band_x = wx0 + (wx1-wx0) * min(1.0, t/DUR)
    # active lancet (centre) shows current scene; side lancets dimmed
    lancet_w, lancet_h = 420, 640
    xs = [wx0+40, wx0+490, wx0+940]
    ly = wy0+120
    # side panels (dim context)
    side = [panels['cornelius'], panels['athens'], panels['sodom']]
    for i, px in enumerate(xs):
        if i == 1:
            panel = panels[pname]
            crop = crop_for_move(panel, move, prog)
            bright = crop.resize((lancet_w, lancet_h), Image.BILINEAR)
            arr = np.array(bright).astype(np.float32) * 2.1
            bright = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        else:
            bright = side[i if i == 0 else 2].resize((lancet_w, lancet_h), Image.BILINEAR)
            arr = np.array(bright).astype(np.float32) * 0.55
            bright = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        mask = Image.new('L', (lancet_w, lancet_h), 0)
        md = ImageDraw.Draw(mask)
        md.rectangle([0, 100, lancet_w, lancet_h], fill=255)
        md.pieslice([0, 0, lancet_w, 200], 180, 360, fill=255)
        im.paste(bright, (px, ly), mask)
        d = ImageDraw.Draw(im, 'RGBA')
        d.rectangle([px, ly+100, px+lancet_w, ly+lancet_h], outline=LEAD, width=8)
        d.pieslice([px, ly, px+lancet_w, ly+200], 180, 360, outline=LEAD, width=8)
        d.line([px+lancet_w//2, ly, px+lancet_w//2, ly+lancet_h], fill=(20, 20, 24), width=6)
    # rose
    rose = panels['rose'].resize((300, 300))
    rose_lit = 0.3 + 0.7*math.sin(math.pi*min(1.0, t/DUR))
    rose_b = rose.point(lambda v: min(255, int(v*rose_lit*2.0)))
    im.paste(rose_b, (W//2-150, wy0-10))
    d = ImageDraw.Draw(im, 'RGBA')
    d.ellipse([W//2-150, wy0-10, W//2+150, wy0+290], outline=LEAD, width=8)
    # floor + patch
    d.rectangle([0, 820, W, H], fill=(70, 62, 54))
    for y in range(820, H, 60):
        d.line([0, y, W, y], fill=(55, 48, 42), width=3)
    patch = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(patch)
    pd.ellipse([band_x-300, 860, band_x+300, 1060], fill=(29, 58, 156, 90))
    pd.ellipse([band_x-150, 880, band_x+150, 1040], fill=(168, 16, 28, 70))
    patch = patch.filter(ImageFilter.GaussianBlur(30))
    im = Image.alpha_composite(im.convert('RGBA'), patch).convert('RGB')
    d = ImageDraw.Draw(im, 'RGBA')
    for i in range(5):
        sx = wx0 + i*280
        d.polygon([(sx, 100), (sx+120, 100), (sx+300, 900), (sx+80, 900)], fill=(255, 240, 200, 18))
    draw_banderole_short(d, text, prog)
    if t < 2.0:
        d.text((W//2-400, 400), "WHAT HAPPENS TO PEOPLE", font=serif(64), fill=PARCH, stroke_width=2, stroke_fill=GRIS)
        d.text((W//2-400, 480), "WHO NEVER HEARD OF JESUS?", font=serif(64), fill=PARCH, stroke_width=2, stroke_fill=GRIS)
    return np.array(im)

def main():
    print("Pre-rendering panels...")
    get_panels()
    print(f"Rendering {NFRAMES} frames (fast-cut, 2s scenes)...")
    ff = imageio_ffmpeg.get_ffmpeg_exe()
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
        if (i+1) % 480 == 0: print(f"  frame {i+1}/{NFRAMES}")
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
