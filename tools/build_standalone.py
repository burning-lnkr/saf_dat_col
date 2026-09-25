from pathlib import Path
import re,base64,json,sys
R=Path(__file__).resolve().parents[1]
embed={p.relative_to(R).as_posix():base64.b64encode(p.read_bytes()).decode() for p in (R/'data').iterdir() if p.name!='piecewise_fits.json'}
modules=[]
for f in ['codec.js','render.js','png.js','worker.js']:
 s=(R/'js'/f).read_text()
 s=re.sub(r'^import .*?;\s*','',s,flags=re.M)
 s=re.sub(r'\bexport (async function|function|const|class)\b',r'\1',s)
 if f=='worker.js':
  s=s.replace("const base=new URL('../',import.meta.url);", "const base='https://local.invalid/';")
  s=s.replace("async function fetchBytes(path){", "async function fetchBytes(path){if(EMBED[path])return Uint8Array.from(atob(EMBED[path]),x=>x.charCodeAt(0));")
 modules.append(s)
worker='const EMBED='+json.dumps(embed,separators=(',',':'))+';\n'+'\n'.join(modules)
render=(R/'js/render.js').read_text();default=re.search(r'export const DEFAULTS=\{.*?\n\};',render,re.S).group().replace('export ','')
app=(R/'js/app.js').read_text();app=re.sub(r'^import .*?;\s*','',app,flags=re.M);app=default+'\n'+app
html=(R/'index.html').read_text().replace('<link rel="stylesheet" href="./style.css">','<style>\n'+(R/'style.css').read_text()+'\n</style>')
html=html.replace('<script type="module" src="./js/app.js"></script>','<script>window.SAF_WORKER_BUNDLE='+json.dumps(worker).replace('</','<\\/')+';</script>\n<script type="module">\n'+app+'\n</script>')
html=re.sub(r'<p><a href="\./README.md".*?</p>','',html)
P=Path(sys.argv[1]) if len(sys.argv)>1 else R.parent/'saf-byte-workbench.html'
P.parent.mkdir(parents=True,exist_ok=True)
P.write_text(html,encoding='utf-8')
print('Standalone bytes',P.stat().st_size)
