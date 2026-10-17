// Trang cho khách: ảnh bìa lớn, danh mục, mẫu hoa, đặt qua Zalo hoặc gọi điện. Không cần đăng nhập.
import { loadBackend } from './backend.js';
import { html, raw, ICON, money, toast, errMsg, phoneDigits, phoneFmt, today, ddmm, sheet } from './util.js';
import { nextHoliday, priceOf } from './stats.js';

const FLOWER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="9" r="2.2"/><path d="M12 6.8C11 3.5 13 3.5 12 6.8M14.2 9c3.3-1 3.3 1 0 0M9.8 9c-3.3-1-3.3 1 0 0M12 11.2c-1 3.3 1 3.3 0 0M12 13v8M12 17c2-2 4-2 5-1.5M12 19c-2-2-4-2-5-1.5"/></svg>';

// Hoa văn dưới tên shop, kiểu thiệp mời.
const ORNAMENT = '<svg class="orn" viewBox="0 0 160 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><path d="M6 12h46M108 12h46"/><path d="M52 12c7-8 14-8 18 0M108 12c-7-8-14-8-18 0"/><circle cx="80" cy="12" r="3.5"/><path d="M80 3.5c-3 2.5-3 4.5 0 5M80 20.5c3-2.5 3-4.5 0-5M71.5 12c2.5-3 4.5-3 5 0M88.5 12c-2.5 3-4.5 3-5 0"/></svg>';

// Hoa hồng nét mảnh làm nền đầu trang khi shop chưa tải ảnh bìa.
const rose = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M100 38A40 40 0 0 1 159 81A40 40 0 0 1 136 150A40 40 0 0 1 64 150A40 40 0 0 1 41 81A40 40 0 0 1 100 38Z"/><path d="M100 100m-6 0a6 6 0 1 1 12 0a12 12 0 1 1-24 0a20 20 0 1 1 40 0a30 30 0 1 1-60 0a42 42 0 1 1 84 0"/></g>`;
const leaf = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0C30-28 78-28 110 0C78 28 30 28 0 0Z"/><path d="M8 0H100"/></g>`;
const DECO = `<svg class="hero-deco" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" fill="none" stroke-width="1.3" aria-hidden="true">
  <g stroke="#9CC2A9" opacity=".55">${leaf(660, 330, -30)}${leaf(930, 640, 20)}${leaf(120, 610, -160)}${leaf(1010, 170, 200)}</g>
  <g stroke="#F3D3DE">${rose(700, 40, 2.2)}${rose(980, 430, 1.3)}${rose(-40, 480, 1.1)}${rose(340, -90, 0.9)}</g>
</svg>`;

const STEPS = [
  ['Chọn mẫu', 'Xem mẫu hoa và giá ngay trên trang này.'],
  ['Nhắn Zalo hoặc gọi', 'Báo mẫu, ngày giờ giao và lời nhắn trên thiệp.'],
  ['Xác nhận đơn', 'Shop báo lại giá, giờ giao và cách thanh toán.'],
  ['Nhận hoa', 'Giao tận nơi hoặc ghé shop lấy.'],
];

// Chưa có ảnh: nền pastel đổi màu theo mẫu cho đỡ đơn điệu.
const productImage = (p, cls) => (p.photo_url
  ? html`<img class="${cls}" src="${p.photo_url}" alt="${p.name}" loading="lazy">`
  : html`<div class="${cls} ph tint${Number(p.id) % 4}" role="img" aria-label="${p.name}">${raw(FLOWER)}</div>`);

function render(root, { shop, products }) {
  const t = today();
  const phone = phoneDigits(shop.phone);
  const zalo = phoneDigits(shop.zalo) || phone;
  const zaloUrl = zalo ? `https://zalo.me/${zalo}` : '';
  const mapUrl = shop.address ? `https://maps.google.com/?q=${encodeURIComponent(shop.address)}` : '';
  const holiday = nextHoliday(shop.holidays, t, 14);
  const city = (shop.address || '').split(',').pop().trim() || 'Hoa tươi';
  const slogan = shop.slogan || 'Hoa tươi cho mọi khoảnh khắc';
  const catCount = new Map();
  for (const c of products.flatMap((p) => p.categories || [])) catCount.set(c, (catCount.get(c) || 0) + 1);
  const cats = [...catCount.keys()].sort((a, b) => catCount.get(b) - catCount.get(a) || a.localeCompare(b, 'vi'));
  const st = { cat: '', q: '' };
  document.title = `${shop.shop_name} · Mẫu hoa & bảng giá`;

  const note = (p) => (holiday && holiday.daysLeft > 0 && p.holiday_price != null && p.holiday_price !== p.price
    ? `Dịp ${ddmm(holiday.date)}: ${money(p.holiday_price)}` : '');
  const zaloBtn = (cls, label) => zaloUrl
    && html`<a class="btn ${cls}" href="${zaloUrl}" target="_blank" rel="noopener" data-zalo>${raw(ICON.chat)}${label}</a>`;
  const callBtn = (cls, label) => phone && html`<a class="btn ${cls}" href="tel:${phone}">${raw(ICON.phone)}${label}</a>`;

  root.innerHTML = html`
    <div class="topbar"><div class="wrap">
      <span class="tagline">${slogan}</span>
      <span class="contacts">
        ${phone && html`<a href="tel:${phone}">${raw(ICON.phone)}<span>${phoneFmt(phone)}</span></a>`}
        ${zaloUrl && html`<a href="${zaloUrl}" target="_blank" rel="noopener" data-zalo>${raw(ICON.chat)}<span>Zalo</span></a>`}
      </span>
    </div></div>
    ${cats.length > 0 && html`
      <nav class="catnav" aria-label="Danh mục hoa"><div class="wrap">
        <button class="on" data-cat="">Tất cả</button>
        ${cats.map((c) => html`<button data-cat="${c}">${c}</button>`)}
      </div></nav>`}

    <header class="hero ${shop.cover_url ? 'has-photo' : 'no-photo'}">
      ${shop.cover_url ? html`<img class="hero-bg" src="${shop.cover_url}" alt="" fetchpriority="high">` : raw(DECO)}
      <div class="hero-brand">
        ${raw(ORNAMENT)}
        <div class="hero-name">${shop.shop_name}</div>
        <div class="hero-city">${city}</div>
      </div>
      <div class="hero-copy wrap">
        <h1>${slogan}</h1>
        ${shop.intro && html`<p>${shop.intro}</p>`}
        <div class="cta">
          <a class="btn btn-lg btn-light" href="#mau-hoa">Xem mẫu hoa</a>
          ${zaloBtn('btn-lg btn-primary', 'Nhắn Zalo đặt hoa') || callBtn('btn-lg btn-primary', 'Gọi đặt hoa')}
        </div>
      </div>
    </header>

    <main class="wrap">
      ${holiday && html`
        <div class="card rose season">
          <div><b>${holiday.daysLeft === 0 ? `Hôm nay là ${ddmm(holiday.date)}` : `Đặt trước hoa ${ddmm(holiday.date)}`}</b>
            <div class="small" style="color: #6B4552">${holiday.daysLeft === 0 ? 'Shop vẫn nhận đơn giao trong ngày.' : `Còn ${holiday.daysLeft} ngày. Đặt sớm để giữ mẫu và giờ giao.`}</div></div>
          ${zaloBtn('btn-primary btn-sm', 'Đặt ngay')}
        </div>`}

      <section class="steps" aria-label="Cách đặt hoa">
        ${STEPS.map(([title, text], i) => html`<div class="step"><div class="step-no">0${i + 1}</div><b>${title}</b><p>${text}</p></div>`)}
      </section>

      <section class="catalog" id="mau-hoa" aria-labelledby="cat-title">
        <div class="catalog-head">
          <div><div class="kicker">Bộ sưu tập</div><h2 id="cat-title">Mẫu hoa</h2></div>
          ${products.length > 6 && html`<label class="search">${raw(ICON.search)}<input type="search" id="q" placeholder="Tìm mẫu hoa…" aria-label="Tìm mẫu hoa"></label>`}
        </div>
        <div class="grid-products" id="grid"></div>
      </section>
    </main>

    <section class="custom-band">
      <div class="wrap">
        <div class="kicker">Thiết kế riêng</div>
        <h2>Muốn bó hoa theo ý bạn?</h2>
        <p>Gửi màu sắc, ngân sách và dịp tặng, shop sẽ tư vấn và báo giá.</p>
        ${zaloBtn('btn-lg btn-light', 'Nhắn tư vấn') || callBtn('btn-lg btn-light', 'Gọi tư vấn')}
      </div>
    </section>

    <footer class="foot">
      <div class="wrap">
        <div><div class="foot-name">${shop.shop_name}</div><div class="hero-city">${city}</div></div>
        <div class="foot-info">
          ${shop.address && html`<a href="${mapUrl}" target="_blank" rel="noopener">${raw(ICON.pin)}${shop.address}</a>`}
          ${shop.open_hours && html`<span>${raw(ICON.clock)}${shop.open_hours}</span>`}
          ${phone && html`<a href="tel:${phone}">${raw(ICON.phone)}${phoneFmt(phone)}</a>`}
        </div>
      </div>
    </footer>
    ${(zaloUrl || phone) && html`<div class="dock"><div>${zaloBtn('btn-primary', 'Nhắn Zalo')}${callBtn('', 'Gọi ngay')}</div></div>`}`.s;

  const grid = root.querySelector('#grid');
  function drawGrid() {
    const q = st.q.toLowerCase();
    const shown = products.filter((p) => (!st.cat || p.categories?.includes(st.cat))
      && (!q || `${p.name} ${p.description}`.toLowerCase().includes(q)));
    grid.innerHTML = shown.length ? shown.map((p) => html`
      <button class="p-card" data-pid="${p.id}">
        <span class="p-media">${productImage(p, 'p-img')}</span>
        <span class="p-body">
          <span class="p-name">${p.name}</span>
          <span class="p-price">${money(priceOf(p, t, shop.holidays))}</span>
          ${note(p) && html`<span class="p-note">${note(p)}</span>`}
        </span>
      </button>`.s).join('')
      : html`<div class="card empty" style="grid-column: 1 / -1">${products.length ? 'Không có mẫu phù hợp.' : 'Shop đang cập nhật mẫu hoa. Nhắn Zalo để được tư vấn nhé!'}</div>`.s;
  }

  // Zalo không cho điền sẵn tin nhắn qua link: chép sẵn nội dung để khách dán vào.
  const copyOrder = (text) => {
    navigator.clipboard?.writeText(text).then(() => toast('Đã chép tên mẫu hoa, dán vào Zalo để nhắn shop'), () => {});
  };
  root.addEventListener('click', (e) => {
    const card = e.target.closest('[data-pid]');
    if (card) { openDetail(products.find((p) => String(p.id) === card.dataset.pid)); return; }
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      st.cat = cat.dataset.cat;
      root.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', b === cat));
      root.querySelector('#cat-title').textContent = st.cat || 'Mẫu hoa';
      drawGrid();
      root.querySelector('#mau-hoa').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('[data-zalo]')) copyOrder(`Chào ${shop.shop_name}, mình muốn đặt hoa.`);
  });
  root.querySelector('#q')?.addEventListener('input', (e) => { st.q = e.target.value.trim(); drawGrid(); });

  function openDetail(p) {
    const price = priceOf(p, t, shop.holidays);
    sheet({
      title: p.name,
      wide: true,
      body: html`<div class="detail-layout">
        ${productImage(p, 'detail-img')}
        <div class="stack detail-info">
        ${p.categories?.length ? html`<div class="row" style="justify-content: flex-start; flex-wrap: wrap; gap: 6px">${p.categories.map((c) => html`<span class="chip c-rose">${c}</span>`)}</div>` : ''}
        <div class="detail-price">${money(price)}</div>
        ${note(p) && html`<div class="p-note" style="font-size: 13px">${note(p)}</div>`}
        ${p.description && html`<p class="detail-desc">${p.description}</p>`}
        <div class="stack">
          ${zaloUrl && html`<a class="btn btn-primary btn-lg" href="${zaloUrl}" target="_blank" rel="noopener" id="order-zalo">${raw(ICON.chat)}Đặt mẫu này qua Zalo</a>`}
          ${phone && html`<a class="btn btn-lg" href="tel:${phone}">${raw(ICON.phone)}Gọi đặt hoa</a>`}
          ${zaloUrl && html`<div class="tip">Bấm “Đặt qua Zalo”, tên mẫu hoa được chép sẵn để bạn dán vào tin nhắn.</div>`}
        </div>
        </div></div>`,
      onMount(dlg) {
        dlg.querySelector('#order-zalo')?.addEventListener('click', () => {
          copyOrder(`Chào ${shop.shop_name}, mình muốn đặt mẫu "${p.name}" (${money(price)}). Shop tư vấn giúp mình nhé!`);
        });
      },
    });
  }

  // Cuộn qua ảnh bìa: hiện thanh nút liên hệ ở đáy (điện thoại).
  const sentinel = root.querySelector('.hero .cta');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => document.body.classList.toggle('scrolled', !entry.isIntersecting)).observe(sentinel);
  } else {
    document.body.classList.add('scrolled');
  }

  drawGrid();
}

async function start() {
  const root = document.getElementById('store');
  try {
    const db = await loadBackend();
    if (db.mode === 'demo') document.getElementById('demo').classList.remove('hidden');
    render(root, await db.publicCatalog());
  } catch (e) {
    console.error(e);
    root.innerHTML = html`<div class="wrap" style="padding-top: 48px"><div class="card stack">
      <h2>Chưa tải được mẫu hoa</h2><div class="muted">${errMsg(e)}</div>
      <button class="btn btn-primary" onclick="location.reload()">Thử lại</button></div></div>`.s;
  }
}

start();
