// Service worker Lumaway — PWA shell + auto-update.
//
// FIX: versi cache dinaikkan (v5 → v6) dan shell ("/" & "/dashboard") TIDAK lagi
// di-cache offline-first. Sebelumnya shell di-precache lalu di-"stale-while-revalidate",
// sehingga UI lama tetap tampil di Vercel walau sudah deploy baru dan user sudah
// clear cache aplikasi. Sekarang navigasi selalu ambil network terbaru; cache hanya
// dipakai sebagai fallback offline. Naikkan CACHE_VERSION setiap kali ada perubahan
// penting agar klien lama otomatis dibersihkan.
const CACHE_VERSION = "v6";
const CACHE = `lumaway-shell-${CACHE_VERSION}`;
// Hanya aset yang benar-benar statis & aman untuk offline. Shell HTML tidak di-precache.
const STATIC = ["/offline.html", "/manifest.webmanifest", "/luma-mark.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

function isSensitive(url) {
  return url.pathname.startsWith("/api/") ||
    url.pathname.includes("/auth/") ||
    /supabase|xendit|mayar|payment|checkout/i.test(url.href);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isSensitive(url)) return;
  // Bundel Next.js sudah punya hashing & cache immutable sendiri — jangan diganggu.
  if (url.pathname.startsWith("/_next/")) return;

  // Navigasi (HTML) SELALU dari network dulu supaya UI terbaru selalu tampil.
  // Cache hanya fallback saat offline. Hasil network tidak disimpan agar UI lama
  // tidak pernah terhidang kembali.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  if (!/\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico)$/i.test(url.pathname)) return;
  // Aset statis: network-first, fallback ke cache saat offline.
  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok) {
        caches.open(CACHE).then(cache => cache.put(request, response.clone())).catch(() => undefined);
      }
      return response;
    }).catch(() => caches.match(request))
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
