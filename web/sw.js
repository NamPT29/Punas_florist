// Bản trước đặt service worker ở gốc trang (bộ nhớ đệm shophoa-v1…v6). Nay chuyển vào /quan-ly/sw.js;
// file này chỉ gỡ bản cũ khỏi máy đã cài, không đụng tới bộ nhớ đệm của bản mới.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(self.registration.unregister()
    .then(() => caches.keys())
    .then((keys) => Promise.all(keys.filter((k) => /^shophoa-v[1-6]$/.test(k)).map((k) => caches.delete(k)))));
});
