"""Compose exact-data PNG previews; no image generation or content inference."""
from pathlib import Path
import hashlib,json,shutil
from PIL import Image,ImageDraw,ImageFont,PngImagePlugin

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
m=json.loads((HERE/'manifest.json').read_text())
# Optimize PNG storage without changing a single rendered RGB value.
for case in m['cases']:
    for info in case['images']:
        if 'sha256' in info:info['cacheSha256']=info.pop('sha256')
        if 'bytes' in info:info['cacheBytes']=info.pop('bytes')
        if not info['published']:continue
        src=Image.open(ROOT/info['cache'])
        assert src.getchannel('A').getextrema()==(255,255)
        rgb=src.convert('RGB'); meta=PngImagePlugin.PngInfo()
        if 'SAF.recipe' in src.info:meta.add_itxt('SAF.recipe',src.info['SAF.recipe'])
        target=ROOT/info['published'];rgb.save(target,optimize=True,pnginfo=meta)
        if target.stat().st_size>(ROOT/info['cache']).stat().st_size:shutil.copyfile(ROOT/info['cache'],target)
        check=Image.open(target).convert('RGB');assert check.tobytes()==rgb.tobytes()
        info['publishedPngSha256']=hashlib.sha256(target.read_bytes()).hexdigest()
        info['publishedPngBytes']=target.stat().st_size
(HERE/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
def font(n,bold=False):
    try:return ImageFont.truetype('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf',n)
    except OSError:return ImageFont.load_default(size=n)
bg='#111923'; fg='#eaf0f5'; muted='#aebbc7'; accent='#81c7e6'
pad,gap,cellw=30,20,640
imageh=round(785*cellw/5000)
tileh=imageh*4
rowh=tileh+94
width=pad*2+4*cellw+3*gap
height=225+len(m['cases'])*rowh+95
out=Image.new('RGB',(width,height),bg); d=ImageDraw.Draw(out)
d.text((pad,24),'SAF data | source-interpretation comparison',font=font(36,True),fill=fg)
d.text((pad,78),'Every panel comes from the actual capture. Alternatives are provisional; no reconstruction is authenticated.',font=font(22),fill=muted)
d.text((pad,112),'Hypothesis: width 5000, RGB8, stride 15001, prefix 1; initial history is zero-filled. All settings are fixed across cases.',font=font(21),fill=muted)
d.text((pad,146),'Overview: area-average to 640px width, then repeat preview rows 4x. Use the native PNGs to inspect individual pixels.',font=font(21),fill=muted)
for j,v in enumerate(m['views']):d.text((pad+j*(cellw+gap),192),v['title'],font=font(23,True),fill=accent)
for i,c in enumerate(m['cases']):
    y=225+i*rowh
    d.text((pad,y),c['title'],font=font(25,True),fill=fg)
    d.text((pad+410,y+3),c['detail'],font=font(21),fill=muted)
    for j,im in enumerate(c['images']):
        a=Image.open(ROOT/im['cache']).convert('RGB').resize((cellw,imageh),Image.Resampling.BOX)
        a=a.resize((cellw,tileh),Image.Resampling.NEAREST)
        x=pad+j*(cellw+gap);out.paste(a,(x,y+40));d.rectangle((x,y+40,x+cellw-1,y+40+tileh-1),outline='#3c4c5a')
d.text((pad,height-68),'The stripe survives these alternatives. The RGB panels remain unresolved. Output displacement can change the apparent colors.',font=font(22),fill=fg)
d.text((pad,height-35),'Sources, exact recipe deltas, hashes and native checks accompany this sheet in research/2026-10-20/.',font=font(20),fill=muted)
out.save(HERE/'source_interpretation_comparison.png',optimize=True)

# Fixed in advance of visual inspection: same native-pixel crop for every case.
crop=(1800,80,2440,240)
cw,ch=crop[2]-crop[0],crop[3]-crop[1]
cropout=Image.new('RGB',(pad*2+cw*3+gap*2,185+len(m['cases'])*(ch+83)+70),bg); cd=ImageDraw.Draw(cropout)
cd.text((pad,22),'Fixed native-pixel crops | no resampling',font=font(32,True),fill=fg)
cd.text((pad,70),'Columns 1800–2439; rows 80–239. Identical crop, byte layout and inverse-filter settings in every row.',font=font(21),fill=muted)
cd.text((pad,106),'These panels compare alternatives; they do not establish which bytes are original.',font=font(21),fill=muted)
for j,key in enumerate(['raw_rgb','sub_rgb','paeth_rgb']):
    title=next(v['title'] for v in m['views'] if v['key']==key)
    cd.text((pad+j*(cw+gap),150),title,font=font(23,True),fill=accent)
for i,c in enumerate(m['cases']):
    y=185+i*(ch+83);cd.text((pad,y),c['title']+'  |  '+c['detail'],font=font(21),fill=fg)
    for j,key in enumerate(['raw_rgb','sub_rgb','paeth_rgb']):
        im=next(im for im in c['images'] if im['view']==key)
        a=Image.open(ROOT/im['cache']).convert('RGB').crop(crop)
        cropout.paste(a,(pad+j*(cw+gap),y+35))
cd.text((pad,cropout.height-48),'Nominal zero history and the 5000-pixel raster assumption are shared by all five cases.',font=font(21),fill=muted)
cropout.save(HERE/'fixed_native_crops.png',optimize=True)
for p in [HERE/'source_interpretation_comparison.png',HERE/'fixed_native_crops.png']:
    print(json.dumps({'file':str(p.relative_to(ROOT)),'size':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}))
