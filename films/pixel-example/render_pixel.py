#!/usr/bin/env python3
"""The Last Delivery — 16-bit Pixel RPG example (Lemo-Opuscar styles/pixel-rpg).
Python port of the demo engine grammar: 320x180 indexed framebuffer x6,
ENDESGA-32 palette + protected reds, LUT palette collapse/flood, dialog boxes,
chiptune + foley. Original story/art/music. 15s, 1920x1080, 24fps.
"""
import math, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
OUT_MP4 = ROOT / "the_last_delivery.mp4"
OUT_WAV = ROOT / "soundtrack.wav"
OUT_SRT = ROOT / "subtitles_en.srt"
OUT_POSTER = ROOT / "poster.jpg"

W, H, SCALE = 320, 180, 6
FPS = 24
DUR = 15.0
NFRAMES = int(FPS * DUR)
SR = 44100

# ---------- palette (ENDESGA-32 + protected, from px.js) ----------
HEX = ['#be4a2f','#d77643','#ead4aa','#e4a672','#b86f50','#733e39','#3e2731','#a22633',
 '#e43b44','#f77622','#feae34','#fee761','#63c74d','#3e8948','#265c42','#193c3e',
 '#124e89','#0099db','#2ce8f5','#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466',
 '#262b44','#181425','#ff0044','#68386c','#b55088','#f6757a','#e8b796','#c28569',
 '#e43b44','#a22633','#f6757a','#2ce8f5','#0099db','#ffffff','#124e89']
def hx(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))
RGB = np.array([hx(h) for h in HEX], dtype=np.float64)
NPAL = len(HEX)
PROTECT = {32,33,34,35,36,37,38}
from types import SimpleNamespace
C = SimpleNamespace(rust=0,clay=1,sand=2,tan=3,brown=4,dbrown=5,umber=6,crimson=7,red=8,orange=9,
 amber=10,yellow=11,lime=12,green=13,dgreen=14,teal=15,navy=16,blue=17,cyan=18,white=19,
 silver=20,steel=21,slate=22,dslate=23,night=24,ink=25,hot=26,plum=27,rose=28,pink=29,
 skin=30,skinS=31,scarf=32,scarfD=33,scarfL=34,xc=35,xb=36,xw=37,xd=38)
T = 255
LUM = RGB @ np.array([0.299,0.587,0.114])

def lut_from(fn):
    L = np.zeros((256,3), dtype=np.uint8)
    for i in range(NPAL): L[i] = np.clip(np.round(fn(i)),0,255).astype(np.uint8)
    return L
def nearest(c, palette_rgb):
    d = ((palette_rgb - c)**2 * np.array([0.3,0.59,0.11])).sum(axis=1)
    return palette_rgb[int(np.argmin(d))]
FADED_RAMP = np.array([hx(h) for h in ['#0e0d17','#1d2031','#2d3349','#434c66','#646e8a','#8f99b0','#c3c9d6']], dtype=np.float64)
def faded_idx(i): return min(6, int(math.floor((LUM[i]/255.0)**0.8 * 7.2)))
LUT_FULL = lut_from(lambda i: RGB[i])
LUT_FADED = lut_from(lambda i: RGB[i] if i in PROTECT else FADED_RAMP[faded_idx(i)])
NES = np.array([hx(h) for h in ['#000000','#fcfcfc','#a4a4b8','#58587c','#1c2c8c','#3c7cfc','#94e0fc','#b8141c','#fc7454','#fcb81c','#8c4c1c','#2c9c2c','#fcd8a8','#0c4c18','#4c2410']], dtype=np.float64)
LUT_NES = lut_from(lambda i: RGB[i] if i in PROTECT else nearest(RGB[i], NES))
SUB16 = RGB[[25,24,23,22,21,19,16,17,7,8,9,10,11,27,28,5]]
LUT_C16 = lut_from(lambda i: RGB[i] if i in PROTECT else nearest(RGB[i], SUB16))
SUB8 = RGB[[25,23,21,19,7,9,11,27]]
LUT_C8 = lut_from(lambda i: RGB[i] if i in PROTECT else nearest(RGB[i], SUB8))

B4 = np.array([0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5], dtype=np.float64)
def bayer(x, y): return (B4[(y & 3)*4 + (x & 3)] + 0.5) / 16.0
BAYER = np.zeros((H, W))
for y in range(H):
    for x in range(W): BAYER[y, x] = bayer(x, y)
def hash2(x, y=0, z=0):
    h = (x*374761393 + y*668265263 + z*2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296.0

# ---------- framebuffer ----------
class FB:
    def __init__(self): self.d = np.zeros((H, W), dtype=np.uint8)
    def clear(self, c=0): self.d.fill(c)
    def px(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H and c != T: self.d[y, x] = c
    def rect(self, x, y, w, h, c):
        x, y, w, h = int(round(x)), int(round(y)), int(round(w)), int(round(h))
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x+w), min(H, y+h)
        if x1 > x0 and y1 > y0: self.d[y0:y1, x0:x1] = c
    def hline(self, x0, x1, y, c):
        y = int(y); x0, x1 = int(round(x0)), int(round(x1))
        if 0 <= y < H:
            a, b = max(0, min(x0, x1)), min(W-1, max(x0, x1))
            if b >= a: self.d[y, a:b+1] = c
    def disc(self, cx, cy, r, c):
        for yy in range(int(math.floor(-r)), int(math.ceil(r))+1):
            for xx in range(int(math.floor(-r)), int(math.ceil(r))+1):
                if xx*xx + yy*yy <= r*r + r*0.8: self.px(cx+xx, cy+yy, c)
    def gradV(self, x0, y0, w, h, cols):
        n = len(cols) - 1
        for j in range(int(h)):
            v = j / max(1, h-1) * n; b = min(n-1, int(math.floor(v))); f = v - b
            for i in range(int(w)):
                X, Y = int(x0)+i, int(y0)+j
                if 0 <= X < W and 0 <= Y < H:
                    self.d[Y, X] = cols[b+1] if bayer(X, Y) < f else cols[b]
    def blit(self, spr, dx, dy, flip=False):
        sw, sh, sd = spr
        for y in range(sh):
            for x in range(sw):
                c = sd[y, sw-1-x] if flip else sd[y, x]
                if c != T: self.px(dx+x, dy+y, c)

def spr_from_rows(rows, mp):
    h = len(rows); w = max(len(r) for r in rows)
    d = np.full((h, w), T, dtype=np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in ('.', ' '): continue
            d[y, x] = mp[ch]
    return (w, h, d)

# ---------- pixel font (from font.js glyphs) ----------
G = {}
def defg(ch, *rows): G[ch] = rows
defg('A','.###.','#...#','#...#','#####','#...#','#...#','#...#')
defg('B','####.','#...#','#...#','####.','#...#','#...#','####.')
defg('C','.###.','#...#','#....','#....','#....','#...#','.###.')
defg('D','####.','#...#','#...#','#...#','#...#','#...#','####.')
defg('E','#####','#....','#....','####.','#....','#....','#####')
defg('F','#####','#....','#....','####.','#....','#....','#....')
defg('G','.###.','#...#','#....','#.###','#...#','#...#','.####')
defg('H','#...#','#...#','#...#','#####','#...#','#...#','#...#')
defg('I','###','.#.','.#.','.#.','.#.','.#.','###')
defg('J','..###','...#.','...#.','...#.','...#.','#..#.','.##..')
defg('K','#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#')
defg('L','#....','#....','#....','#....','#....','#....','#####')
defg('M','#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#')
defg('N','#...#','##..#','#.#.#','#..##','#...#','#...#','#...#')
defg('O','.###.','#...#','#...#','#...#','#...#','#...#','.###.')
defg('P','####.','#...#','#...#','####.','#....','#....','#....')
defg('Q','.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#')
defg('R','####.','#...#','#...#','####.','#.#..','#..#.','#...#')
defg('S','.####','#....','#....','.###.','....#','....#','####.')
defg('T','#####','..#..','..#..','..#..','..#..','..#..','..#..')
defg('U','#...#','#...#','#...#','#...#','#...#','#...#','.###.')
defg('V','#...#','#...#','#...#','#...#','#...#','.#.#.','..#..')
defg('W','#...#','#...#','#...#','#.#.#','#.#.#','##.##','#...#')
defg('X','#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#')
defg('Y','#...#','#...#','.#.#.','..#..','..#..','..#..','..#..')
defg('Z','#####','....#','...#.','..#..','.#...','#....','#####')
defg('a','....','....','.##.','...#','.###','#..#','.###')
defg('b','#...','#...','###.','#..#','#..#','#..#','###.')
defg('c','...','...','.##','#..','#..','#..','.##')
defg('d','...#','...#','.###','#..#','#..#','#..#','.###')
defg('e','....','....','.##.','#..#','####','#...','.###')
defg('f','..#','.#.','###','.#.','.#.','.#.','.#.')
defg('g','....','....','.###','#..#','#..#','#..#','.###','...#','.##.')
defg('h','#...','#...','###.','#..#','#..#','#..#','#..#')
defg('i','#','.','#','#','#','#','#')
defg('j','..#','...','..#','..#','..#','..#','..#','#.#','.#.')
defg('k','#...','#...','#..#','#.#.','##..','#.#.','#..#')
defg('l','#.','#.','#.','#.','#.','#.','.#')
defg('m','.....','.....','##.#.','#.#.#','#.#.#','#.#.#','#.#.#')
defg('n','....','....','###.','#..#','#..#','#..#','#..#')
defg('o','....','....','.##.','#..#','#..#','#..#','.##.')
defg('p','....','....','###.','#..#','#..#','#..#','###.','#...','#...')
defg('q','....','....','.###','#..#','#..#','#..#','.###','...#','...#')
defg('r','...','...','#.#','##.','#..','#..','#..')
defg('s','...','...','.##','#..','.#.','..#','##.')
defg('t','.#.','.#.','###','.#.','.#.','.#.','..#')
defg('u','....','....','#..#','#..#','#..#','#..#','.###')
defg('v','.....','.....','#...#','#...#','#...#','.#.#.','..#..')
defg('w','.....','.....','#...#','#...#','#.#.#','#.#.#','.#.#.')
defg('x','....','....','#..#','#..#','.##.','#..#','#..#')
defg('y','....','....','#..#','#..#','#..#','#..#','.###','...#','.##.')
defg('z','....','....','####','...#','.##.','#...','####')
defg('0','.###.','#...#','#..##','#.#.#','##..#','#...#','.###.')
defg('1','.#.','##.','.#.','.#.','.#.','.#.','###')
defg('2','.###.','#...#','....#','...#.','..#..','.#...','#####')
defg('3','####.','....#','....#','.###.','....#','....#','####.')
defg('4','...#.','..##.','.#.#.','#..#.','#####','...#.','...#.')
defg('5','#####','#....','####.','....#','....#','#...#','.###.')
defg('6','.###.','#....','#....','####.','#...#','#...#','.###.')
defg('7','#####','....#','...#.','..#..','.#...','.#...','.#...')
defg('8','.###.','#...#','#...#','.###.','#...#','#...#','.###.')
defg('9','.###.','#...#','#...#','.####','....#','....#','.###.')
defg('.','.','.','.','.','.','.','#')
defg(',','..','..','..','..','..','.#','.#','#. ')
defg('!','#','#','#','#','#','.','#')
defg('?','.###.','#...#','....#','..##.','..#..','.....','..#..')
defg("'",'#','#','.','.','.','.','.')
defg('-','...','...','...','###','...','...','...')
defg(':','.','.','#','.','.','.','#')
defg('/','....#','...#.','...#.','..#..','.#...','.#...','#....')
defg('×','.....','.....','#...#','.#.#.','..#..','.#.#.','#...#')
defg('·','.','.','.','#','.','.','.')
defg('(','.#','#.','#.','#.','#.','#.','.#')
defg(')','#.','.#','.#','.#','.#','.#','#.')
defg('=','....','....','####','....','####','....','....')
defg('+','...','...','.#.','###','.#.','...','...')
defg('%','##..#','##.#.','...#.','..#..','.#...','.#.##','#..##')
defg('♥','.....','##.##','#####','#####','.###.','..#..','.....')
defg('▶','#...','##..','###.','####','###.','##..','#...')
defg('▼','.....','.....','#####','.###.','..#..','.....','.....')
defg(' ','..','..','..','..','..','..','..')
LINE_H = 10
def glyphW(ch): return len((G.get(ch) or G['?'])[0])
def textW(s, sc=1):
    w = 0
    for ch in s: w += (glyphW(ch)+1)*sc
    return max(0, w-sc)
def text(fb, s, x0, y0, col, shadow=None, sc=1):
    x = x0
    for ch in s:
        g = G.get(ch) or G['?']
        if shadow is not None:
            for yy, row in enumerate(g):
                for bb, pxc in enumerate(row):
                    if pxc == '#': fb.rect(x+bb*sc+1, y0+yy*sc+1, sc, sc, shadow)
        for yy, row in enumerate(g):
            for bb, pxc in enumerate(row):
                if pxc == '#': fb.rect(x+bb*sc, y0+yy*sc, sc, sc, col)
        x += (len(g[0])+1)*sc
    return x
def text_outlined(fb, s, x0, y0, col, outline, sc=2):
    for dx, dy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1),(0,2),(1,2),(-1,2)]:
        text(fb, s, x0+dx, y0+dy, outline, None, sc)
    return text(fb, s, x0, y0, col, None, sc)
def wrap(s, maxW):
    words = s.split(' '); lines = []; cur = ''
    for w in words:
        t = (cur + ' ' + w) if cur else w
        if textW(t) > maxW and cur: lines.append(cur); cur = w
        else: cur = t
    if cur: lines.append(cur)
    return lines

# ---------- sprites ----------
HEAD_SIDE = spr_from_rows([
 '......jjjj....',
 '...jjhhhhhhj..',
 '..jhhHHHHHhhj.',
 '.jhHHHHHHHHhhj',
 'jjhHHhhhhhhhhh',
 '.jjhhhhhhhhhhh',
 '..jhhhhhhjhjhh',
 '.jjhhhhhjffhff',
 'jjhhhhhFfffbbf',
 '.jjhhhFFfffeff',
 '..jhhhFffffeff',
 '..jjhhhFfffff.',
 '....jjFffffmf.',
 '......FFfff...',
], {'j':C.umber,'h':C.dbrown,'H':C.brown,'f':C.skin,'F':C.skinS,'b':C.umber,'e':C.ink,'m':C.umber})
HEAD_FRONT = spr_from_rows([
 '...jj.jj.jj...',
 '..jhhjhhjhhj..',
 '.jhHHHHHHHHhj.',
 'jhHHHhhhhhHhhj',
 'jhhhhhhhhhhhhj',
 'jhhjhhhjhhjhhj',
 'jhhfjhffhjffhj',
 'jhfbbffffbbfhj',
 'Fhfewffffwefhf',
 'FFfeFffffFefFF',
 '.FFfffffffffF.',
 '..FFfffmfffF..',
 '...FFFffffF...',
 '.....FFFF.....',
], {'j':C.umber,'h':C.dbrown,'H':C.brown,'f':C.skin,'F':C.skinS,'b':C.umber,'e':C.ink,'w':C.white,'m':C.umber})
HAND = spr_from_rows(['.kk......','kwwk.....','kwwwkkkk.','kwwwwwwwk','kwwwwkkk.','kwwwwk...','.kkkk....'],
 {'k':C.ink,'w':C.white})

def draw_hero(fb, x, y, walk_phase=0, kneel=False, hop=0):
    """Hero ~22x34: head + tunic + red scarf (protected) + legs. walk_phase 0..3."""
    x, y = int(x), int(y - hop)
    # legs
    if kneel:
        fb.rect(x+5, y+24, 12, 4, C.night); fb.rect(x+5, y+24, 12, 1, C.dslate)
        fb.rect(x+4, y+28, 5, 2, C.umber); fb.rect(x+13, y+28, 5, 2, C.umber)
    else:
        ph = walk_phase % 4
        # leg offsets per phase
        offs = [(0,0),(1,0),(0,0),(-1,0)]
        ox = offs[ph][0]
        fb.rect(x+5, y+24, 4, 7, C.night); fb.rect(x+13, y+24, 4, 7, C.night)
        fb.rect(x+5+ox, y+31, 5, 2, C.umber); fb.rect(x+13-ox, y+31, 5, 2, C.umber)
        if ph in (1, 3):
            fb.rect(x+5, y+24, 4, 1, C.dslate); fb.rect(x+13, y+24, 4, 1, C.dslate)
    # tunic body
    fb.rect(x+4, y+13, 14, 12, C.navy); fb.rect(x+4, y+13, 14, 2, C.blue)
    fb.rect(x+4, y+13, 1, 12, C.ink); fb.rect(x+17, y+13, 1, 12, C.ink)
    fb.rect(x+10, y+13, 2, 12, C.ink)
    # belt
    fb.rect(x+4, y+22, 14, 2, C.umber); fb.rect(x+10, y+22, 2, 2, C.amber)
    # arms
    fb.rect(x+2, y+14, 3, 9, C.navy); fb.rect(x+17, y+14, 3, 9, C.navy)
    fb.rect(x+2, y+23, 3, 3, C.skin); fb.rect(x+17, y+23, 3, 3, C.skin)
    # scarf (protected red) + flutter tails (3-frame cycle)
    fb.rect(x+4, y+12, 14, 2, C.scarf); fb.rect(x+4, y+12, 14, 1, C.scarfL)
    fl = (walk_phase + int(y*0.1)) % 3
    tail = [(0,0),(1,1),(2,2)][fl]
    fb.rect(x+3-tail[0], y+14+tail[1], 3, 2, C.scarfD)
    fb.rect(x+4-tail[0], y+15+tail[1], 2, 1, C.scarf)
    # head
    fb.blit(HEAD_SIDE, x+4, y-1)

def draw_portrait(fb, x, y, expr='smile'):
    """32x32 portrait: face + eyes + mouth overlays."""
    fb.rect(x, y, 32, 32, C.navy)
    # hair
    fb.rect(x+4, y+2, 24, 6, C.dbrown); fb.rect(x+4, y+2, 24, 2, C.brown)
    fb.rect(x+4, y+2, 4, 14, C.dbrown); fb.rect(x+24, y+2, 4, 14, C.dbrown)
    # face
    fb.rect(x+7, y+8, 18, 16, C.skin); fb.rect(x+7, y+8, 18, 2, C.sand)
    # eyes
    if expr == 'sad':
        fb.rect(x+10, y+15, 3, 2, C.ink); fb.rect(x+19, y+15, 3, 2, C.ink)
        fb.rect(x+10, y+13, 3, 1, C.umber); fb.rect(x+19, y+13, 3, 1, C.umber)
    else:
        fb.rect(x+10, y+14, 3, 3, C.ink); fb.rect(x+19, y+14, 3, 3, C.ink)
        fb.rect(x+11, y+14, 1, 1, C.white); fb.rect(x+20, y+14, 1, 1, C.white)
    # brows
    fb.rect(x+9, y+12, 5, 1, C.umber); fb.rect(x+18, y+12, 5, 1, C.umber)
    # mouth
    if expr == 'smile': fb.rect(x+13, y+20, 6, 1, C.umber); fb.rect(x+14, y+21, 4, 1, C.umber)
    elif expr == 'sad': fb.rect(x+14, y+21, 4, 1, C.umber)
    else: fb.rect(x+14, y+20, 4, 1, C.umber)
    # scarf
    fb.rect(x+7, y+24, 18, 3, C.scarf); fb.rect(x+7, y+24, 18, 1, C.scarfL)
    fb.rect(x+7, y+27, 18, 5, C.navy)

def draw_flower(fb, x, y, t):
    """Red flower on pedestal (protected red)."""
    fb.rect(x-6, y+10, 12, 3, C.slate); fb.rect(x-8, y+13, 16, 2, C.dslate)
    fb.rect(x-1, y+2, 2, 8, C.dgreen)
    fb.rect(x-4, y+5, 4, 2, C.green); fb.rect(x+1, y+7, 4, 2, C.green)
    fb.disc(x, y, 4, C.scarf); fb.disc(x, y, 2, C.scarfL); fb.px(x, y, C.yellow)
    # sparkles
    for i in range(6):
        a = t*2 + i*1.047
        sx = int(x + math.cos(a)*10); sy = int(y-2 + math.sin(a)*6)
        if i % 2 == 0: fb.px(sx, sy, C.yellow)
        else: fb.px(sx, sy, C.white)

def draw_crystal(fb, x, y, t):
    """Save crystal (protected cyans), 8 frames per 90 deg."""
    ph = int(t*8) % 8
    wob = [0,1,2,2,1,0,-1,-1][ph]
    fb.rect(x-6, y+14, 12, 3, C.slate); fb.rect(x-8, y+17, 16, 2, C.dslate)
    fb.rect(x-3+wob, y+2, 6, 12, C.xc); fb.rect(x-3+wob, y+2, 2, 12, C.xw)
    fb.rect(x-1+wob, y+2, 2, 12, C.xb)
    fb.disc(x+wob, y+6, 2, C.white)
    # halo (Bayer ring)
    for yy in range(-8, 9):
        for xx in range(-8, 9):
            r = math.hypot(xx, yy)
            if 6 < r < 9 and bayer(x+xx, y+yy) < 0.5: fb.px(x+wob+xx, y+6+yy, C.xc)

# ---------- UI ----------
def win(fb, x, y, w, h):
    fb.rect(x+2, y, w-4, h, C.ink); fb.rect(x, y+2, w, h-4, C.ink); fb.rect(x+1, y+1, w-2, h-2, C.ink)
    fb.rect(x+2, y+1, w-4, h-2, C.white); fb.rect(x+1, y+2, w-2, h-4, C.white)
    fb.rect(x+2, y+2, w-4, h-4, C.silver)
    fb.gradV(x+3, y+3, w-6, h-6, [C.blue, C.navy, C.navy, C.night])
    fb.hline(x+3, x+w-4, y+3, C.blue)

def dialog(fb, s, t, cps=38, portrait_expr='smile'):
    X, Y, Wd, Hd = 8, 134, 304, 42
    win(fb, X, Y, Wd, Hd)
    draw_portrait(fb, X+5, Y+5, portrait_expr)
    tx = X+5+32+7
    n = max(0, int(t*cps))
    lines = wrap(s, X+Wd-tx-8)
    used = 0
    for i, ln in enumerate(lines):
        vis = ln[:max(0, n-used)]; used += len(ln)+1
        text(fb, vis, tx, Y+9+i*12, C.white, C.night)
    if n >= len(s) and int(t*3) % 2 == 0:
        text(fb, '▼', X+Wd-14, Y+Hd-12, C.white)
    return n

def battle_msg(fb, s, t):
    w = max(120, textW(s)+24); x = int(round((W-w)/2))
    win(fb, x, 4, w, 17)
    n = int(t*45)
    text(fb, s[:n], x+int(round((w-textW(s))/2)), 9, C.white, C.night)

def hand(fb, x, y, t, bob=True):
    fb.blit(HAND, x + (1 if (bob and int(t*4) % 2) else 0), y)

# ---------- scenes ----------
def draw_sky(fb, cam, t, night=False):
    if night:
        fb.gradV(0, 0, W, H, [C.night, C.ink, C.ink])
        for i in range(60):
            sx = int(hash2(i, 7)*W); sy = int(hash2(i, 13)*90)
            if int(t*2 + i) % 3 != 0: fb.px(sx, sy, C.silver)
        fb.disc(260, 30, 10, C.silver); fb.disc(260, 30, 8, C.white)
    else:
        fb.gradV(0, 0, W, H, [C.blue, C.navy, C.navy, C.night])
        fb.disc(40, 26, 8, C.yellow); fb.disc(40, 26, 6, C.amber)

def draw_hills(fb, cam):
    # far layer 0.35x
    off = int(cam*0.35)
    for x in range(W):
        wx = x + off
        hgt = int(20 + 10*math.sin(wx*0.02) + 6*math.sin(wx*0.05+1.3))
        y0 = 110 - hgt
        for y in range(y0, 128): fb.px(x, y, C.dslate)
    fb.hline(0, W-1, 110, C.slate)

def draw_mid(fb, cam, t):
    # mid layer 0.7x: trees + houses
    off = int(cam*0.7)
    for i in range(12):
        wx = i*60 + int(hash2(i, 3)*30)
        sx = wx - off
        if -30 < sx < W+30:
            # tree
            fb.rect(sx, 96, 4, 32, C.umber)
            fb.disc(sx+2, 88, 10, C.dgreen); fb.disc(sx+2, 88, 7, C.green)
            fb.px(sx+2, 88, C.lime)
            # house every 3rd
            if i % 3 == 0:
                fb.rect(sx+16, 104, 22, 24, C.tan); fb.rect(sx+16, 104, 22, 3, C.rust)
                fb.rect(sx+24, 112, 6, 8, C.umber)
                fb.rect(sx+18, 110, 4, 4, C.yellow); fb.rect(sx+31, 110, 4, 4, C.yellow)

def draw_ground(fb, cam):
    off = int(cam)
    fb.rect(0, 128, W, H-128, C.dgreen)
    fb.rect(0, 128, W, 2, C.green)
    for x in range(W):
        wx = x + off
        if hash2(wx, 11) < 0.25: fb.px(x, 132 + int(hash2(wx, 17)*30), C.green)
        if hash2(wx, 23) < 0.08: fb.px(x, 130 + int(hash2(wx, 29)*20), C.lime)
    # path
    for x in range(W):
        wx = x + off
        if 118 < (wx % 240) < 150: fb.rect(x, 126, 1, 4, C.tan)

def draw_pillars(fb, cam):
    off = int(cam*1.6)
    for i in range(4):
        wx = i*110 + 20
        sx = wx - off
        if -20 < sx < W+20:
            fb.rect(sx, 0, 10, 128, C.night); fb.rect(sx, 0, 2, 128, C.dslate)
            fb.rect(sx-2, 120, 14, 8, C.dslate)

def mosaic_rgb(img, n):
    if n <= 1: return img
    out = img.copy()
    ox, oy = (W//2) % n, (H//2) % n
    for y in range(H):
        by = max(0, (y-oy)//n*n + oy)
        for x in range(W):
            bx = max(0, (x-ox)//n*n + ox)
            out[y, x] = img[min(H-1, by), min(W-1, bx)]
    return out

# ---------- audio (chiptune + foley, original) ----------
def pulse(freq, t, duty=0.25):
    ph = (freq*t) % 1.0
    return np.where(ph < duty, 1.0, -1.0)
def tri(freq, t):
    ph = (freq*t) % 1.0
    return 2*np.abs(2*ph-1)-1
NOTE = {'C4':261.63,'D4':293.66,'E4':329.63,'F4':349.23,'G4':392.0,'A4':440.0,'Bb4':466.16,
 'C5':523.25,'D5':587.33,'E5':659.25,'F5':698.46,'G5':783.99,'A5':880.0,'C6':1046.5,'F6':1396.9}
MOTIF = ['F4','C5','A4','Bb4','C5','F5']  # original ascending motif, F major
BASS = ['F4','F4','Bb4','Bb4','F4','F4','C5','C5']

def synth_audio():
    n = int(SR*DUR)
    t = np.arange(n)/SR
    L = np.zeros(n); R = np.zeros(n)
    # music grid: 120 BPM, bar = 2s
    def in_section(tt, a, b): return (tt >= a) & (tt < b)
    # lead motif loop (8 notes per 2 bars = 4s cycle)
    lead = np.zeros(n); bass = np.zeros(n); drums = np.zeros(n)
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n)
    # simple one-pole lowpass for drums
    drums = np.zeros(n); a = 0.3
    for i in range(1, n): drums[i] = drums[i-1] + a*(noise[i]-drums[i-1])
    drums = drums * 0.25
    # note schedule: each motif note 0.5s
    for k, nn in enumerate(MOTIF):
        f = NOTE[nn]
        for rep in range(4):
            s0 = int((rep*4 + k*0.5)*SR); s1 = int((rep*4 + k*0.5 + 0.45)*SR)
            if s1 > n: break
            seg = t[s0:s1]
            env = np.minimum(1, (seg-seg[0])*20) * np.exp(-(seg-seg[0])*2.5)
            lead[s0:s1] += pulse(f, seg, 0.25) * env * 0.22
    for k, nn in enumerate(BASS):
        f = NOTE[nn]/2
        for rep in range(2):
            s0 = int((rep*8 + k*1.0)*SR); s1 = int((rep*8 + k*1.0 + 0.9)*SR)
            if s1 > n: break
            seg = t[s0:s1]
            env = np.minimum(1, (seg-seg[0])*20) * np.exp(-(seg-seg[0])*1.8)
            bass[s0:s1] += tri(f, seg) * env * 0.30
    # drums on beats (kick-ish low thump + hat noise)
    for b in range(8):
        s0 = int(b*2.0*SR); s1 = min(n, s0+int(0.12*SR))
        seg = t[s0:s1]
        drums[s0:s1] += np.sin(2*np.pi*55*seg)*np.exp(-seg*30)*0.5
        s0h = int((b*2.0+1.0)*SR); s1h = min(n, s0h+int(0.05*SR))
        if s1h > s0h: drums[s0h:s1h] += noise[s0h:s1h]*0.12*np.exp(-np.arange(s1h-s0h)/SR*60)
    # collapse layering: 7.5 harmony out, 8.5 echo/stereo out, 9.5 bass out, 9.5-10.5 single tone
    # (implemented as gain envelopes on the mixed music)
    music = lead*0.9 + bass + drums*0.8
    # echo (SNES-style: 3 taps)
    echo = np.zeros(n)
    for dly, g in [(int(0.18*SR),0.35),(int(0.27*SR),0.25),(int(0.37*SR),0.18)]:
        echo[dly:] += music[:-dly]*g
    music_e = music + echo*0.7
    # gain envelopes
    g = np.ones(n)
    # collapse 7.5-10.5: thin out
    i75, i85, i95, i105 = [int(x*SR) for x in (7.5, 8.5, 9.5, 10.5)]
    g[i75:i85] = 0.55
    g[i85:i95] = 0.30
    # 9.5-10.4 single square tone only
    g[i95:i105] = 0.0
    single = np.zeros(n)
    s0, s1 = i95, int(10.4*SR)
    seg = t[s0:s1]
    single[s0:s1] = pulse(880, seg, 0.5)*np.minimum(1,(seg-seg[0])*20)*np.exp(-(seg-seg[0])*1.2)*0.15
    # true silence 10.4-10.5
    g[int(10.4*SR):i105] = 0.0
    music_m = music_e*g + single
    # stereo: slight width via echo delay on R
    L = music_m.copy(); R = music_m.copy()
    dly = int(0.012*SR)
    R[dly:] = music_m[:-dly]*0.9
    # foley
    def blip(t0, f=880, dur=0.06, vol=0.25):
        s0 = int(t0*SR); s1 = min(n, s0+int(dur*SR))
        seg = t[s0:s1]
        L[s0:s1] += pulse(f, seg, 0.5)*np.minimum(1,(seg-seg[0])*80)*np.exp(-(seg-seg[0])*40)*vol
        R[s0:s1] += pulse(f, seg, 0.5)*np.minimum(1,(seg-seg[0])*80)*np.exp(-(seg-seg[0])*40)*vol
    def fanfare(t0):
        for i, nn in enumerate(['F5','A5','C6','F6']):
            blip(t0+i*0.09, NOTE[nn], 0.22, 0.30)
    def bitdrop(t0, f=440):
        s0 = int(t0*SR); s1 = min(n, s0+int(0.25*SR))
        seg = t[s0:s1]
        sweep = f*np.exp(-(seg-seg[0])*6)
        L[s0:s1] += pulse(sweep, seg, 0.25)*np.exp(-(seg-seg[0])*8)*0.30
        R[s0:s1] += pulse(sweep, seg, 0.25)*np.exp(-(seg-seg[0])*8)*0.30
    def footstep(t0):
        s0 = int(t0*SR); s1 = min(n, s0+int(0.07*SR))
        seg = t[s0:s1]
        L[s0:s1] += noise[s0:s1]*np.exp(-(seg-seg[0])*60)*0.20
        R[s0:s1] += noise[s0:s1]*np.exp(-(seg-seg[0])*60)*0.20
    # schedule foley
    blip(0.0, 880); blip(2.0, 660); blip(2.5, 880)
    for tt in np.arange(2.2, 5.0, 0.45): footstep(tt)
    for tt in np.arange(2.1, 4.6, 0.12): blip(tt, 1200, 0.03, 0.10)  # text blips
    fanfare(5.2)
    bitdrop(7.5, 660); bitdrop(8.5, 440); bitdrop(9.5, 330)
    # flood swell
    s0 = int(10.5*SR); s1 = int(11.2*SR)
    seg = t[s0:s1]
    L[s0:s1] += pulse(440+440*(seg-seg[0]), seg, 0.25)*np.minimum(1,(seg-seg[0])*3)*0.15
    R[s0:s1] += pulse(440+440*(seg-seg[0]), seg, 0.25)*np.minimum(1,(seg-seg[0])*3)*0.15
    for tt in np.arange(12.6, 14.4, 0.3): blip(tt, 990, 0.05, 0.18)  # save ticks
    blip(14.6, 1320, 0.3, 0.25)
    # normalize to ~-14 LUFS-ish (peak -1 dB)
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
    gnorm = 0.89/peak
    L *= gnorm; R *= gnorm
    # fade last 0.3s
    fl = int(0.3*SR)
    fade = np.linspace(1, 0, fl)
    L[-fl:] *= fade; R[-fl:] *= fade
    return L, R

def write_wav(L, R, path):
    pcm = np.stack([L, R], axis=1)
    pcm16 = (np.clip(pcm, -1, 1)*32767).astype(np.int16)
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes(pcm16.tobytes())

# ---------- render ----------
def lut_for_time(t):
    if t < 7.5: return LUT_FULL, None, 0.0
    if t < 8.5: return LUT_C16, None, 0.0
    if t < 9.5: return LUT_C8, None, 0.0
    if t < 10.5: return LUT_FADED, None, 0.0
    if t < 12.5:
        # Bayer flood: faded -> full
        p = (t-10.5)/2.0
        return LUT_FADED, LUT_FULL, p
    return LUT_FULL, None, 0.0

def render_frame(idx):
    t = idx / FPS
    fb = FB()
    # --- scene selection ---
    if t < 2.0:
        draw_sky(fb, 0, t, night=True)
        # title
        title = "THE LAST DELIVERY"
        tw = textW(title, 2)
        # Bayer-dissolved in/out
        alpha = min(1.0, t/0.5, (2.0-t)/0.5)
        # draw with per-pixel dissolve: approximate by drawing only where bayer < alpha
        # (draw full then erase — simpler: draw if hash < alpha)
        x0 = (W - tw)//2
        # outlined title
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)]:
            text(fb, title, x0+dx, 60+dy, C.ink, None, 2)
        # gradient fill row by row
        # draw white, then silver/steel rows via second pass
        text(fb, title, x0, 60, C.white, None, 2)
        if int(t*2) % 2 == 0:
            ps = "PRESS START"
            text(fb, ps, (W-textW(ps))//2, 110, C.yellow, C.night)
        # hero small at bottom
        draw_hero(fb, 150, 120, walk_phase=int(t*8)%4)
    elif t < 5.0:
        cam = int((t-2.0)*30)  # 30 px/s
        draw_sky(fb, cam, t, night=False)
        draw_hills(fb, cam); draw_mid(fb, cam, t); draw_ground(fb, cam); draw_pillars(fb, cam)
        draw_hero(fb, 120, 94, walk_phase=int(t*8)%4)
        dialog(fb, "HELLO, TRAVELER! I HAVE A DELIVERY.", t-2.0, 38, 'smile')
    elif t < 7.5:
        cam = 90
        draw_sky(fb, cam, t, night=False)
        draw_hills(fb, cam); draw_mid(fb, cam, t); draw_ground(fb, cam); draw_pillars(fb, cam)
        draw_flower(fb, 220, 100, t)
        draw_hero(fb, 120, 94, walk_phase=0)
        # item-get window
        win(fb, 12, 12, 150, 40)
        text(fb, "GOT RED FLOWER!", 20, 20, C.yellow, C.night)
        text(fb, "FLOWER +1", 20, 34, C.white, C.night)
        hand(fb, 16, 20, t, True)
        if t > 6.5:
            battle_msg(fb, "THE FLOWER GLOWS RED!", t-6.5)
    elif t < 10.5:
        cam = 90
        draw_sky(fb, cam, t, night=False)
        draw_hills(fb, cam); draw_mid(fb, cam, t); draw_ground(fb, cam); draw_pillars(fb, cam)
        draw_flower(fb, 220, 100, t)
        draw_hero(fb, 120, 94, walk_phase=0)
        # shake on steps
        if abs(t-7.5) < 0.35 or abs(t-8.5) < 0.35 or abs(t-9.5) < 0.35:
            pass  # shake applied at RGB level below via offset (simplified: skip)
    elif t < 12.5:
        cam = 90
        draw_sky(fb, cam, t, night=False)
        draw_hills(fb, cam); draw_mid(fb, cam, t); draw_ground(fb, cam); draw_pillars(fb, cam)
        draw_flower(fb, 220, 100, t)
        hop = int(4*abs(math.sin((t-10.5)/2.0*math.pi)))
        draw_hero(fb, 120, 94, walk_phase=0, hop=hop)
        dialog(fb, "THE COLOUR IS BACK!", t-10.5, 38, 'smile')
    else:
        cam = 90
        draw_sky(fb, cam, t, night=False)
        draw_hills(fb, cam); draw_mid(fb, cam, t); draw_ground(fb, cam); draw_pillars(fb, cam)
        draw_crystal(fb, 230, 100, t)
        draw_hero(fb, 150, 94, walk_phase=0, kneel=True)
        win(fb, 12, 12, 150, 40)
        text(fb, "GAME SAVED", 20, 20, C.white, C.night)
        text(fb, "SLOT 1 OK", 20, 34, C.silver, C.night)
        if int(t*2) % 2 == 0:
            text(fb, "CONTINUE ▶", (W-textW("CONTINUE ▶"))//2, 118, C.yellow, C.night)
        text(fb, "16-BIT PIXEL RPG", (W-textW("16-BIT PIXEL RPG"))//2, 160, C.silver, C.night)
    # --- LUT present ---
    lutA, lutB, p = lut_for_time(t)
    if lutB is None:
        rgb = lutA[fb.d]
    else:
        rgbA = lutA[fb.d]; rgbB = lutB[fb.d]
        mask = (BAYER < p)[..., None]
        rgb = np.where(mask, rgbB, rgbA)
    # mosaic transitions at cuts
    if (2.0 <= t < 2.6) or (5.0 <= t < 5.6):
        lt = t-2.0 if t < 5.0 else t-5.0
        n = max(1, int(10*(1-lt/0.6)))
        rgb = mosaic_rgb(rgb, n)
    # upscale x6 nearest
    big = np.repeat(np.repeat(rgb, SCALE, axis=0), SCALE, axis=1)
    return big

def main():
    print("Synthesizing chiptune + foley...")
    L, R = synth_audio()
    write_wav(L, R, OUT_WAV)
    print(f"Audio: {OUT_WAV} ({len(L)/SR:.2f}s)")
    # subtitles from same array
    subs = [
        (2.0, 5.0, "HELLO, TRAVELER! I HAVE A DELIVERY."),
        (5.2, 7.5, "GOT RED FLOWER!"),
        (10.5, 12.5, "THE COLOUR IS BACK!"),
        (12.5, 15.0, "GAME SAVED"),
    ]
    def srt_time(s):
        h = int(s//3600); m = int((s%3600)//60); sec = s%60
        return f"{h:02d}:{m:02d}:{sec:06.3f}"
    with open(OUT_SRT, 'w') as f:
        for i, (a, b, s) in enumerate(subs, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{s}\n\n")
    print(f"Subtitles: {OUT_SRT}")
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"Rendering {NFRAMES} frames 1920x1080 @ {FPS}fps...")
    cmd = [ff, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W*SCALE}x{H*SCALE}',
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
