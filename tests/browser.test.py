from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import json,base64,hashlib,io,time,argparse
parser=argparse.ArgumentParser()
parser.add_argument('html',nargs='?',default=str(Path(__file__).resolve().parents[2]/'saf-byte-workbench.html'))
parser.add_argument('--chromium',default=None,help='Optional system Chromium executable')
args=parser.parse_args()
R=Path(__file__).resolve().parent/'browser-artifacts'
R.mkdir(exist_ok=True)
checks=[]

def record(name, detail=True):
    checks.append({'test':name,'result':detail});print('PASS',name,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[];requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content(Path(args.html).read_text(encoding='utf-8'),wait_until='domcontentloaded')
    def wait(): page.wait_for_function('safWorkbench.ready && safWorkbench.result',timeout=90000)
    def setc(**kw): page.evaluate('(o)=>safWorkbench.set(o)',kw);wait();return page.evaluate('safWorkbench.result')
    def wm(action,**kw):
        return page.evaluate('''async m=>{return await new Promise((resolve,reject)=>{const w=safWorkbench.worker();const id=200000+Math.floor(Math.random()*1e6);const timer=setTimeout(()=>reject(Error('Worker timeout')),80000);function read(e){const d=e.data;if(d.id!==id)return;if(d.type==='progress')return;clearTimeout(timer);w.removeEventListener('message',read);if(d.type==='error'){reject(Error(d.error));return;}if(d.data){const a=new Uint8Array(d.data);let t='';for(let i=0;i<a.length;i+=8192)t+=String.fromCharCode(...a.subarray(i,i+8192));d.base64=btoa(t);delete d.data;}resolve(d);}w.addEventListener('message',read);w.postMessage({...m,id});});}''',dict(type=action,**kw))
    wait();r=page.evaluate('safWorkbench.result');assert r['decode']['hash'].startswith('14bbfcec');assert(r['width'],r['height'])==(5000,785);record('Default native grid and combined candidate',r['decode']['hash'])
    assert page.locator('#notice').is_hidden();assert page.evaluate("getComputedStyle(document.querySelector('#canvasB')).imageRendering")=='pixelated'
    # Same exact bytes used for exported repeated rows, captured from live worker.
    setc(startRow=65,rows=8)
    config=page.evaluate('safWorkbench.state');d=wm('export',kind='png',config=config)
    blob=base64.b64decode(d['base64']);(R/'browser_export.png').write_bytes(blob)
    im=Image.open(io.BytesIO(blob));im.load();assert im.size==(5000,80);assert 'SAF.recipe' in im.info
    import numpy as np
    a=np.asarray(im);assert all(np.array_equal(a[y],a[y//10*10]) for y in range(80));record('Browser PNG export and exact tenfold row repetition',{'dimensions':im.size,'bytes':len(blob)})
    # A/B controls and source select.
    setc(startRow=0,rows=0);page.locator('#pinA').click();page.locator('[data-source="community"]').click();wait();assert page.evaluate('safWorkbench.result.decode.hash').startswith('3245e6d141');assert not page.locator('#paneA').is_hidden();record('Community source and pinned A/B')
    page.locator('#diffBtn').click();assert page.locator('#dimensions').inner_text().endswith('Δ');page.locator('#diffBtn').click()
    # Both repair families older than v5.
    setc(source='original',candidate='more_CR_repairs');assert page.evaluate('safWorkbench.result.decode.recipeMatch');record('v3 more-CR recipe')
    setc(candidate='runaware');assert page.evaluate('safWorkbench.result.decode.recipeMatch');record('v4 run-aware recipe')
    # Live source-level distance re-selection against frozen grammar.
    r=setc(candidate='headerguided',distancePolicy='context',modelKind='recorded',rows=50)
    assert r['decode']['hash'].startswith('c87f6752');assert r['decode']['edited']==1005;record('Live copy-context search reproduces prior candidate',r['decode']['edited'])
    r=setc(modelKind='local');assert r['decode']['modelTriples']>5000;record('Live local model training',{'triples':r['decode']['modelTriples'],'hash':r['decode']['hash']})
    # Restore original defaults and scan frame phase.
    r=setc(candidate='combined',distancePolicy='keep',modelKind='recorded',rows=0)
    scans=wm('scan',stride=15001,rows=246,origin=0)['scores'];assert scans[0]['bad']==64;record('Live all-phase scan',scans[0])
    # All visual mappings respond to the same current decoded payload.
    for mode in ['magnitude','magrgb','signed','signedrgb','rawrgb','rawgray','shared','family','zero','distance','length','block','origin','fresh','history']:
        r=setc(mode=mode,startRow=65,rows=20)
        assert r['width']==5000 and r['height']==20
    record('Fifteen additional mappings')
    # Inverse filters, stored filter fallback, and byte-level inspector.
    for f in ['0','1','2','3','4','stored']:
        r=setc(mode='rawrgb',filter=f,invalidFilter='0',startRow=5,rows=5)
        assert r['height']==5
    rec=wm('inspect',x=1500,y=1)['info'];assert rec['indices'][0]==6*15001+1+1500*3;assert rec['source']['uploadedByte']>0;record('Filters and compressed-source inspector',rec['source'])
    # Repeating a seed and setting block restarts must materially change history.
    r=setc(filter='off',mode='classifier',seedHex='07',historyMode='block',rows=8,startRow=0)
    assert not r['decode']['recipeMatch'];record('Seed and block-history experiment')
    setc(seedHex='00',historyMode='continuous',rows=0)
    # JSON recipe editing opens selected block and replay of unchanged recipe.
    page.locator('#recipeBtn').click();page.wait_for_selector('#recipeDialog[open]');page.locator('#recipeScope').select_option('11');block=json.loads(page.locator('#recipeText').input_value());assert 'header' in block and 'repairs' in block;page.locator('#applyRecipe').click();wait();assert page.evaluate('safWorkbench.result.decode.recipeMatch');record('Editable per-block recipe and exact replay')
    # Deliberate broken bit field recovers through restoring the recipe.
    r=setc(patches='bad json');assert not page.locator('#notice').is_hidden();assert page.locator('#exportBtn').is_disabled();setc(patches='',recipeOverride='');assert page.locator('#notice').is_hidden();record('Bad custom patch handled and restored')
    # LZW probe, independent view state.
    page.locator('#lzwView').evaluate('e=>e.click()');wait();r=page.evaluate('safWorkbench.result');assert r['decode']['bytes']==68 and r['decode']['codes']==16;assert(r['width'],r['height'])==(17,4);record('Live LZW prefix',{'indices':r['decode']['bytes'],'codes':r['decode']['codes']})
    # Load custom byte file then save / reopen complete experiment.
    page.locator('#byteFile').set_input_files({'name':'test.bin','mimeType':'application/octet-stream','buffer':bytes([0,4,7,249,252,128])*32});wait();assert page.evaluate('safWorkbench.result.decode.bytes')==192
    setc(width=16,stride=48,channels=3,prefix=0,channelMap='0,1,2',rows=4,mode='classifier',rawGain=1,repeat=3,zoom='fit')
    with page.expect_download(timeout=20000) as dd:page.locator('#saveProject').click()
    saved=dd.value; saved.save_as(R/'browser_saved_setup.json');project=json.loads((R/'browser_saved_setup.json').read_text());assert project['localBytes'];record('Local binary upload and setup export')
    page.locator('#reset').click();wait();assert page.evaluate('safWorkbench.result.decode.recipeMatch')
    page.locator('#projectFile').set_input_files(str(R/'browser_saved_setup.json'));wait();assert page.evaluate('safWorkbench.result.decode.bytes')==192;assert page.evaluate('safWorkbench.state.repeat')==3;record('Complete setup restores uploaded bytes')
    # Restore native default, pin pixel to demonstrate provenance.
    page.locator('#reset').click();wait();page.locator('#fitZoom').click();page.locator('#canvasB').hover(position={'x':365,'y':225});page.wait_for_timeout(250)
    page.screenshot(path=str(R/'desktop_final.png'),full_page=True)
    record('Desktop screenshot',str(R/'desktop_final.png'))
    # Frequent edits exercise cache and pending-run handling.
    page.evaluate('''()=>{for(let i=0;i<8;i++)safWorkbench.set({mode:i%2?'classifier':'magnitude',rows:10+i});}''');wait();assert page.evaluate('safWorkbench.result.height')==17;record('Rapid edits settle on newest settings')
    # Small-screen real layout.
    page.set_viewport_size({'width':390,'height':844});page.locator('#reset').click();wait();page.screenshot(path=str(R/'mobile_final.png'),full_page=True)
    overflow=page.evaluate('document.documentElement.scrollWidth > window.innerWidth');record('Mobile layout',{'horizontalOverflow':overflow})
    assert not overflow
    assert not errors,errors
    record('No browser runtime errors',errors);record('Standalone external network requests',[u for u in requests if not u.startswith('blob:')])
    assert all(u.startswith('blob:') for u in requests), requests
    browser.close()
(R/'browser_validation.json').write_text(json.dumps({'checks':checks,'browser':'Chromium via Playwright; standalone loaded into page document'},indent=2))
print('BROWSER TESTS PASSED',flush=True)
