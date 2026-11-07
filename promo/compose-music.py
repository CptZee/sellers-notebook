"""Original 95 BPM acoustic-style cue; all instruments synthesized, no samples."""
from pathlib import Path
import json, wave
import numpy as np

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'audio'
SR=48000
DURATION=15
rng=np.random.default_rng(20261107)
bed=np.zeros((SR*DURATION,2),dtype=np.float64)
beat=60/95

def hz(midi): return 440*2**((midi-69)/12)
def add(target,signal,start,amp=1,pan=0):
    offset=int(start*SR)
    if offset<0 or offset>=len(target):return
    signal=signal[:len(target)-offset]*amp
    target[offset:offset+len(signal),0]+=signal*np.sqrt((1-pan)/2)
    target[offset:offset+len(signal),1]+=signal*np.sqrt((1+pan)/2)

def pluck(midi,length=2.6):
    # Damped harmonic string, softened fingertip attack and soundboard resonance.
    t=np.arange(int(SR*length))/SR
    f=hz(midi)
    sound=np.zeros_like(t)
    for k in range(1,15):
        weight=np.sin(k*np.pi*.22)**2/k**1.5
        sound+=weight*np.cos(2*np.pi*f*k*t)*np.exp(-t*(1.1+.36*k))
    return sound*(1-np.exp(-t*400))*np.exp(-t*.2)

def piano(midi,length=3.0):
    t=np.arange(int(SR*length))/SR
    sound=np.zeros_like(t)
    for k in range(1,9):
        sound+=(1/k**2)*np.sin(2*np.pi*hz(midi)*k*np.sqrt(1+.00009*k*k)*t)*np.exp(-t*(1.2+.32*k))
    return sound*(1-np.exp(-t*160))

chords=[[48,55,59,64,67],[43,55,59,62,64],[45,52,55,60,64],[41,53,57,60,64],[43,55,57,62,67],[48,55,60,64,67]]
for bar,notes in enumerate(chords):
    for eighth,index in enumerate([0,2,3,4,1,3,2,4]):
        add(bed,pluck(notes[index]),bar*4*beat+eighth*.5*beat,.16 if index==0 else .11,(-.35 if eighth%2 else .35))
    for i,note in enumerate(notes[2:]):
        add(bed,piano(note+12),bar*4*beat+.07+i*.025,.035,-.1)

for at,note in [(1,76),(3,79),(5,74),(7,76),(9,72),(11,76),(13,69),(15,72),(17,74),(19,79),(21,76),(22,72)]:
    add(bed,piano(note),at*beat,.038,.15)

for n in range(24):
    t=np.arange(int(SR*.18))/SR
    if n%2==0:
        kick=np.sin(2*np.pi*(48*t+35*.035*(1-np.exp(-t/.035))))*np.exp(-t*28)*(1-np.exp(-t*500))
        add(bed,kick,n*beat,.045,0)
    else:
        noise=rng.normal(0,1,len(t));brush=np.concatenate(([0],np.diff(noise)))*np.exp(-t*55)
        add(bed,brush,n*beat,.009,.3)
    noise=rng.normal(0,1,len(t));hat=np.concatenate(([0],np.diff(noise)))*np.exp(-t*90)
    add(bed,hat,(n+.5)*beat,.004,-.35)

# Small room reflections, no external reverb samples.
dry=bed.copy()
for delay,gain in [(.047,.12),(.083,.09),(.137,.05)]:
    shift=int(delay*SR);bed[shift:]+=dry[:-shift,::-1]*gain
time=np.arange(len(bed))/SR
bed*=np.minimum(time/.3,1)[:,None]*np.clip((15-time)/.8,0,1)[:,None]
bed*=.7/max(np.max(np.abs(bed)),.001)

def write(name,signal):
    with wave.open(str(OUT/name),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR)
        f.writeframes((np.clip(signal,-1,1)*32767).astype('<i2').tobytes())

write('fresh-page-original-music.wav',bed)
for name,transitions in [('general',[2.6,3.67,4.73,7.07,10.67]),('operations',[3.9,5.7,8.17,9.7,11.23])]:
    fx=np.zeros_like(bed)
    for at in transitions:
        t=np.arange(int(SR*.28))/SR
        noise=rng.normal(0,1,len(t));soft=np.convolve(noise,np.ones(18)/18,mode='same')
        page=soft*np.sin(np.pi*np.minimum(t/.28,1))**2
        add(fx,page,at-.12,.16,-.2)
        t=np.arange(int(SR*.055))/SR
        pencil=np.sin(2*np.pi*1300*t)*np.exp(-t*120)+rng.normal(0,.12,len(t))*np.exp(-t*95)
        add(fx,pencil,at+.05,.035,.2)
    write(f'{name}-paper-fx.wav',fx)
(OUT/'music-provenance.json').write_text(json.dumps({'title':'A Fresh Page','bpm':95,'duration':15,'instruments':['synthesized plucked nylon-style strings','soft additive piano','light synthesized percussion'],'source':'Original procedural composition; no external recordings or samples','generator':'compose-music.py'},indent=2))
print('Original acoustic-style soundtrack and subtle paper/pencil effects composed.')
