// 委託紀錄簿：離線快取。只快取 App 本身的檔案，你的紀錄不會經過這裡。
// 更新 App 時，把下面的版本號改掉（例如 v8），已安裝的人下次打開就會換成新版。
const VERSION = "v24";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png"];

self.addEventListener("install", e => {
  // cache: "reload" → 安裝時一定從網路拿最新檔案，不用瀏覽器暫存的舊檔
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(CORE.map(u => new Request(u, {cache: "reload"}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "fonts").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 字型：先用快取，背景更新
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){
    e.respondWith(caches.open("fonts").then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // 頁面：有網路就一定拿最新版（不用瀏覽器暫存），離線時才用快取
  if (req.mode === "navigate"){
    e.respondWith(fetch(req.url, {cache: "no-store"})
      .then(r => { if (r.ok){ const cp = r.clone(); caches.open(VERSION).then(c => c.put("./index.html", cp)); } return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  // 其他檔案（圖示等）：先用快取
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
