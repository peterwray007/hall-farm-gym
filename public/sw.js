/* Hall Farm Gym: installable shell only. Never cache bookings, profiles, health data or payments. */
const CACHE="hall-farm-static-v1";
self.addEventListener("install",event=>{self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("hall-farm-static-")&&k!==CACHE).map(k=>caches.delete(k))))]))});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
 const u=new URL(req.url);
 if(!u.pathname.startsWith("/_next/static/")&&!u.pathname.startsWith("/icons/")&&!["/hall-farm-gym-logo.webp","/wray-fitness-logo.webp"].includes(u.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const existing=await cache.match(req);if(existing)return existing;
  const response=await fetch(req);if(response.ok&&response.type==="basic")await cache.put(req,response.clone());
  return response;
 }));
});
