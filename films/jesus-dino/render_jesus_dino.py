#!/usr/bin/env python3
"""15-second, 16-bit pixel-art seaside conversation; dialogue is on-screen."""
from pathlib import Path
import sys, math, subprocess, wave
import numpy as np
from PIL import Image
import imageio_ffmpeg
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
sys.path.insert(0,str(ROOT/'films'/'pixel-example'))
import render_pixel as px
W,H,SCALE,FPS,SR,DUR=320,180,6,24,44100,15
C=px.C
OUT=HERE/'jesus_and_dinosaur_15s.mp4'

def scene_bg(f,t,rain):
    f.gradV(0,0,W,104,[C.plum,C.pink,C.rose,C.blue,C.plum])
    # stepped clouds and sunset
    for x,y,w,h,col in [(12,20,50,5,C.pink),(26,15,24,4,C.rose),(100,32,44,4,C.plum),(196,20,62,6,C.plum),(255,37,40,4,C.blue)]: f.rect(x+int(math.sin(t*.3+x)*2),y,w,h,col)
    f.disc(49,67,20,C.yellow); f.disc(49,67,14,C.amber); f.rect(28,66,43,3,C.pink)
    # two green islands
    for x,w in [(0,90),(211,109)]:
        f.rect(x,92,w,9,C.dgreen); f.rect(x+3,89,w-8,5,C.green)
        for j in range(10): f.rect(x+j*12,86+(j%3)*2,8,5,C.lime if j%4==0 else C.green)
    # striped lighthouse
    f.rect(284,56,8,37,C.white); f.rect(284,66,8,5,C.red); f.rect(284,81,8,5,C.red)
    f.rect(282,52,12,5,C.red); f.rect(284,47,8,6,C.night); f.rect(286,44,4,4,C.yellow)
    if not rain: f.rect(292,52,28,2,C.yellow)
    # sea, reflections, pixel wave highlights
    f.gradV(0,96,W,84,[C.blue,C.cyan,C.navy,C.blue])
    for y in range(102,178,7):
        for x in range((y*7)%31,W,38): f.rect(x+int(math.sin(t+y*.1)*7),y,12+(x%4)*2,1,C.cyan if y%3 else C.blue)
    for j in range(8): f.rect(35+int(math.sin(t+j)*10),106+j*7,25-j*2,1,C.yellow if j<3 else C.amber)
    if rain:
        for i in range(100):
            x=int((i*47+t*55)%W); y=int((i*31+t*93)%H)
            f.rect(x,y,1,4,C.silver if i%4 else C.cyan)
        for y in range(0,55,6):
            for x in range(0,W,4):
                if (x*3+y*7)%13<4: f.px(x,y,C.dslate)

def draw_boat(f,t):
    b=int(math.sin(t*2.1)*1.3)
    f.rect(66,127+b,184,3,C.umber); f.rect(75,130+b,168,5,C.brown)
    f.rect(89,135+b,139,4,C.rust); f.rect(104,139+b,110,2,C.umber)
    for k in range(12): f.px(239+k,126+b-k//3,C.brown)
    f.rect(76,126+b,165,1,C.amber)
    f.rect(160,83+b,3,44,C.umber); f.rect(165,87+b,37,25,C.sand)
    for k in range(7): f.px(170+k*4,91+b+k*2,C.tan)
    for k in range(6): f.rect(85+k*30,146+b+(k%2)*3,16,1,C.cyan)

def jesus(f,x,y,t):
    y+=int(math.sin(t*2)*1)
    # cyan robe and folded legs
    f.rect(x+2,y+17,29,17,C.cyan); f.rect(x,y+27,33,8,C.xb)
    f.rect(x+5,y+18,5,16,C.xw); f.rect(x+16,y+18,3,16,C.xb)
    f.rect(x+4,y+34,30,4,C.navy)
    # long brown hair, face, beard
    f.rect(x+7,y+3,18,15,C.skin); f.rect(x+4,y+2,23,6,C.dbrown)
    f.rect(x+4,y+5,5,16,C.dbrown); f.rect(x+23,y+5,5,14,C.dbrown)
    f.rect(x+8,y+14,16,6,C.brown); f.rect(x+11,y+17,11,4,C.dbrown)
    f.px(x+13,y+10,C.ink); f.px(x+20,y+10,C.ink); f.rect(x+14,y+13,5,1,C.sand)
    f.rect(x+8,y-1,17,1,C.yellow); f.px(x+6,y,C.amber); f.px(x+27,y,C.amber)
    f.rect(x+7,y+21,20,2,C.xw); f.rect(x+23,y+22,8,3,C.skin)

def dino(f,x,y,t):
    y+=int(math.sin(t*2.3+1)*1)
    f.rect(x-17,y+23,18,4,C.green); f.rect(x-21,y+21,9,3,C.dgreen)
    f.rect(x,y+17,28,17,C.green); f.rect(x+4,y+21,19,9,C.lime)
    f.rect(x+4,y+31,10,5,C.dgreen); f.rect(x+19,y+31,10,5,C.dgreen)
    f.rect(x+17,y+3,11,19,C.green); f.rect(x+20,y+6,5,14,C.lime)
    f.rect(x+18,y-1,23,12,C.green); f.rect(x+30,y+5,15,7,C.lime)
    f.rect(x+35,y+9,12,4,C.green); f.px(x+35,y+3,C.ink); f.px(x+36,y+2,C.white)
    f.px(x+44,y+10,C.dgreen); f.px(x+40,y+11,C.dgreen)
    for k in range(4): f.px(x+3+k*5,y+15-k%2*2,C.yellow)
    f.rect(x+17,y+18,8,3,C.dgreen); f.px(x+24,y+20,C.lime)

def caption(f,speaker,text,t):
    px.win(f,6,139,308,36)
    px.text(f,speaker+':',13,144,C.cyan if speaker=='JESUS' else C.lime,C.night)
    words=text.upper().split(); lines=[]; cur=''
    for word in words:
        test=(cur+' '+word).strip()
        if px.textW(test)>286 and cur: lines.append(cur); cur=word
        else: cur=test
    if cur: lines.append(cur)
    full=' '.join(lines); n=min(len(full),max(0,int((t-.12)*35))); used=0
    for j,line in enumerate(lines[:2]):
        px.text(f,line[:max(0,n-used)],13,155+j*9,C.white,C.night); used+=len(line)+1

BEATS=[
(0,2,'','A PIXEL PARABLE: JESUS & A DINOSAUR'),
(2,4,'','A QUIET SAIL BEFORE THE RAIN...'),
(4,6,'JESUS','Why do humans keep changing?'),
(6,8,'DINO','Over generations, traits that help survival spread.'),
(8,10,'DINO','Whoa! This rain evolved fast!'),
(10,12,'JESUS','Our bodies change. What of our hearts?'),
(12,14,'DINO','Maybe we grow kinder, choice by choice.'),
(14,15,'','KEEP GROWING KINDER.'),]

def frame(i):
    t=i/FPS; beat=next((j for j,(a,b,*_) in enumerate(BEATS) if a<=t<b),7)
    a,b,who,line=BEATS[beat]; f=px.FB(); rain=t>=8
    scene_bg(f,t,rain); draw_boat(f,t)
    if beat in (0,1,7): jesus(f,109,88,t); dino(f,179,88,t)
    elif beat in (2,4,5): jesus(f,129,77,t); dino(f,197,89,t)
    else: dino(f,161,77,t); jesus(f,100,91,t)
    if rain:
        for k in range(38): f.rect(int((k*61+t*70)%W),int((k*37+t*103)%H),1,4,C.silver)
        if 9.55<t<9.82:
            for y in range(0,139,8): f.rect(0,y,W,2,C.white)
    if beat==0:
        title='JESUS AND THE DINO'; px.text_outlined(f,title,(W-px.textW(title,2))//2,32,C.white,C.night,2)
        sub='A CHAT ABOUT HUMAN EVOLUTION'; px.text_outlined(f,sub,(W-px.textW(sub))//2,57,C.yellow,C.night,1)
    elif who: caption(f,who,line,t-a)
    elif beat==1: px.text(f,line,20,148,C.white,C.night)
    else: px.text_outlined(f,line,(W-px.textW(line))//2,147,C.yellow,C.night,1)
    rgb=px.LUT_FULL[f.d]
    if beat and t-a<.18: rgb=px.mosaic_rgb(rgb,max(1,int(7*(1-(t-a)/.18))))
    return np.repeat(np.repeat(rgb,SCALE,axis=0),SCALE,axis=1)

def audio():
    n=SR*DUR; t=np.arange(n)/SR; L=np.zeros(n);R=np.zeros(n)
    notes=[523.25,659.25,783.99,659.25,587.33,698.46,880,698.46]
    for i,st in enumerate(np.arange(0,DUR,.5)):
        s=int(st*SR);e=min(n,s+int(.42*SR));q=t[s:e]-st;env=np.minimum(1,q*35)*np.exp(-q*3)
        z=(np.sin(2*np.pi*notes[i%8]*q)+.22*np.sin(4*np.pi*notes[i%8]*q))*env*.13
        L[s:e]+=z;R[s:e]+=z*.94
    noise=np.random.default_rng(41).normal(0,1,n); smooth=np.convolve(noise,np.ones(600)/600,mode='same')
    L+=smooth*.12;R+=np.roll(smooth,800)*.12
    re=np.clip((t-8)/1.8,0,1)*np.clip((15-t)/1.5,0,1)
    L+=noise*.035*re;R+=np.roll(noise,100)*.035*re
    th=np.exp(-np.maximum(0,t-9.55)*2)*((t>=9.55)&(t<11.8));L+=smooth*.8*th;R+=np.roll(smooth,3000)*.8*th
    peak=max(abs(L).max(),abs(R).max(),1e-8);L*=.85/peak;R*=.85/peak
    fade=int(.35*SR); env=np.ones(n);env[-fade:]=np.linspace(1,0,fade)
    return L*env,R*env

def main():
    here=Path(__file__).resolve().parent; wavpath=here/'soundtrack.wav'; poster=here/'poster.jpg'; srt=here/'subtitles_en.srt'
    l,r=audio(); pcm=(np.clip(np.stack([l,r],1),-1,1)*32767).astype(np.int16)
    with wave.open(str(wavpath),'wb') as w: w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    def stamp(s): return f'00:00:{s:06.3f}'
    with open(srt,'w') as out:
        for k,(a,b,who,line) in enumerate(BEATS,1): out.write(f'{k}\n{stamp(a)} --> {stamp(b)}\n{who+": " if who else ""}{line}\n\n')
    ff=imageio_ffmpeg.get_ffmpeg_exe();cmd=[ff,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W*SCALE}x{H*SCALE}','-r',str(FPS),'-i','-','-i',str(wavpath),'-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar',str(SR),'-ac','2','-movflags','+faststart','-shortest',str(OUT)]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE);poster_frame=None
    for i in range(FPS*DUR):
        im=frame(i)
        if i==5*FPS: poster_frame=im.copy()
        p.stdin.write(im.tobytes())
    p.stdin.close();err=p.stderr.read();p.wait()
    if p.returncode: raise RuntimeError(err.decode()[-3000:])
    Image.fromarray(poster_frame).save(poster)
    print(f'Created {OUT} ({OUT.stat().st_size} bytes)')
if __name__=='__main__': main()
