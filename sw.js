importScripts("notif.js");
const CACHE = "info-desa-v7";
const SHELL = ["./", "index.html", "notif.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const cuacaGitHub = e.request.url === URL_CUACA;
  if (!cuacaGitHub && url.origin !== location.origin) return;

  // Data cuaca (GitHub atau salinan lokal): utamakan yang terbaru (maksimal tunggu 8 detik), jika gagal pakai simpanan terakhir
  if (cuacaGitHub || url.pathname.endsWith("/cuaca.json")) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([
          fetch(e.request, { cache: "no-store" }),
          new Promise((_, tolak) => setTimeout(() => tolak(new Error("lambat")), 8000))
        ]);
        if (r.ok) { c.put(e.request, r.clone()); return r; }
      } catch (err) { /* jatuh ke simpanan */ }
      return (await c.match(e.request)) || Response.error();
    })());
    return;
  }

  // Halaman: tampilkan simpanan dulu agar cepat, lalu perbarui di latar belakang
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(h => {
    const baru = fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }).catch(() => h);
    return h || baru;
  })));
});

// Notifikasi latar belakang (Chrome/Edge Android, aplikasi sudah dipasang ke layar utama)
self.addEventListener("periodicsync", e => { if(e.tag === "cuaca") e.waitUntil(cekLatar()); });
async function cekLatar(){
  const c = await caches.open(CACHE); let d;
  for(const u of [URL_CUACA, "cuaca.json"]){
    try{ const r = await fetch(u, {cache:"no-store"}); if(r.ok){ d = await r.json(); c.put(u, new Response(JSON.stringify(d))); break; } }catch(_){}
  }
  if(!d){ for(const u of [URL_CUACA, "cuaca.json"]){ const m = await c.match(u); if(m){ d = await m.json(); break; } } if(!d) return; }
  if(d.contoh) return;
  const sm = await c.match("notif-state"); const sudah = sm ? await sm.json() : {};
  for(const n of hitungNotif(d, Date.now(), sudah)){ sudah[n.tag] = 1; await self.registration.showNotification(n.judul, {body:n.isi, tag:n.tag}); }
  await c.put("notif-state", new Response(JSON.stringify(Object.fromEntries(Object.entries(sudah).slice(-20)))));
}
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:"window"}).then(l => l.length ? l[0].focus() : clients.openWindow("./")));
});
