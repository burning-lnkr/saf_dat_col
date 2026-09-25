/* Relative paths keep the app portable under /repository-name/. */
const PREFIX='saf-byte-workbench:'+self.registration.scope+':';
const CACHE=PREFIX+'1.0.0';
const CORE=['./','./index.html','./style.css','./js/app.js','./js/worker.js','./js/codec.js','./js/render.js','./js/png.js','./data/index.json','./data/trigram.f32'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(CORE);
 const index=await (await cache.match('./data/index.json')).json();
 await cache.addAll([...Object.values(index.sources).map(x=>'./'+x.path),...index.candidates.map(x=>'./'+x.path)]);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),hit=await cache.match(request);
  if(hit)return hit;
  const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;
 })());
});
