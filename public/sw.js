const CACHE = "lumaway-shell-v5";
const STATIC=["/","/dashboard","/offline.html","/manifest.webmanifest","/luma-mark.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).catch(()=>undefined));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

function isSensitive(url){
  return url.pathname.startsWith("/api/")||
    url.pathname.includes("/auth/")||
    /supabase|xendit|mayar|payment|checkout/i.test(url.href);
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||isSensitive(url))return;
  if(url.pathname.startsWith("/_next/"))return;

  if(request.mode==="navigate"){
    event.respondWith(fetch(request, { cache: "no-store" }).catch(()=>caches.match("/offline.html")));
    return;
  }

  if(!/\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico)$/i.test(url.pathname))return;
  event.respondWith(caches.match(request).then(cached=>{
    const network=fetch(request).then(response=>{
      if(response&&response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>undefined);
      return response;
    }).catch(()=>cached);
    return cached||network;
  }));
});

self.addEventListener("message",event=>{
  if(event.data&&event.data.type==="SKIP_WAITING")self.skipWaiting();
});
