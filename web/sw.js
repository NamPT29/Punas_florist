// Service worker: lưu sẵn giao diện để app mở nhanh và mở được khi mạng chập chờn.
// Dữ liệu (Supabase) luôn lấy trực tiếp từ mạng. Đổi VERSION mỗi lần cập nhật giao diện.
const VERSION = 'shophoa-v6';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'icons/icon.svg', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/util.js', 'js/stats.js', 'js/config.js', 'js/backend.js', 'js/backend-demo.js', 'js/backend-supabase.js',
  'js/views/home.js', 'js/views/orders.js', 'js/views/stock.js', 'js/views/products.js',
  'js/views/customers.js', 'js/views/finance.js', 'js/views/more.js',
  'shop/', 'css/shop.css', 'js/shop.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const staticCdn = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(url.hostname);
  if (!sameOrigin && !staticCdn) return;
  // Mạng trước (để luôn có bản mới), mất mạng thì dùng bản đã lưu.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: sameOrigin })
        .then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
