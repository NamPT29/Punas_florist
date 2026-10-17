// Trang cho khách: xem mẫu hoa, giá, đặt qua Zalo hoặc gọi điện. Không cần đăng nhập.
import { loadBackend } from './backend.js';
import { html, raw, ICON, money, toast, errMsg, phoneDigits, phoneFmt, today, ddmm, sheet } from './util.js';
import { nextHoliday, priceOf } from './stats.js';

const FLOWER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="9" r="2.2"/><path d="M12 6.8C11 3.5 13 3.5 12 6.8M14.2 9c3.3-1 3.3 1 0 0M9.8 9c-3.3-1-3.3 1 0 0M12 11.2c-1 3.3 1 3.3 0 0M12 13v8M12 17c2-2 4-2 5-1.5M12 19c-2-2-4-2-5-1.5"/></svg>';

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
  const catCount = new Map();
  for (const c of products.flatMap((p) => p.categories || [])) catCount.set(c, (catCount.get(c) || 0) + 1);
  const cats = [...catCount.keys()].sort((a, b) => catCount.get(b) - catCount.get(a) || a.localeCompare(b, 'vi'));
  const st = { cat: '', q: '' };
  document.title = `${shop.shop_name} · Mẫu hoa & bảng giá`;

  const note = (p) => (holiday && holiday.daysLeft > 0 && p.holiday_price != null && p.holiday_price !== p.price
    ? `Dịp ${ddmm(holiday.date)}: ${money(p.holiday_price)}` : '');
  const contactButtons = (big) => html`
    ${zaloUrl && html`<a class="btn btn-primary ${big ? 'btn-lg' : ''}" href="${zaloUrl}" target="_blank" rel="noopener" data-zalo>${raw(ICON.chat)}Nhắn Zalo</a>`}
    ${phone && html`<a class="btn ${big ? 'btn-lg' : ''}" href="tel:${phone}">${raw(ICON.phone)}Gọi ngay</a>`}`;

  root.innerHTML = html`
    <header class="store-bar">
      <div class="store-wrap">
        <div class="brand"><img src="../icons/icon.svg" alt=""><span class="brand-name">${shop.shop_name}</span></div>
        ${phone && html`<a class="icon-btn" href="tel:${phone}" aria-label="Gọi shop">${raw(ICON.phone)}</a>`}
      </div>
    </header>
    <div class="store-wrap">
      <section class="hero">
        <h1>${shop.shop_name}</h1>
        <p class="intro">${shop.intro || 'Hoa tươi mỗi ngày · Nhận đặt bó hoa, giỏ hoa, giao tận nơi.'}</p>
        <div class="meta">
          ${shop.open_hours && html`<span>${raw(ICON.clock)}${shop.open_hours}</span>`}
          ${phone && html`<a href="tel:${phone}">${raw(ICON.phone)}${phoneFmt(phone)}</a>`}
          ${shop.address && html`<a href="${mapUrl}" target="_blank" rel="noopener">${raw(ICON.pin)}${shop.address}</a>`}
        </div>
        ${(zaloUrl || phone) && html`<div class="cta">${contactButtons(true)}</div>`}
        ${holiday && html`
          <div class="card rose season">
            <div><b>${holiday.daysLeft === 0 ? `Hôm nay là ${ddmm(holiday.date)}` : `Đặt trước hoa ${ddmm(holiday.date)}`}</b>
              <div class="small" style="color: #6B4552">${holiday.daysLeft === 0 ? 'Shop vẫn nhận đơn giao trong ngày.' : `Còn ${holiday.daysLeft} ngày. Đặt sớm để giữ mẫu và giờ giao.`}</div></div>
            ${zaloUrl && html`<a class="btn btn-primary btn-sm" href="${zaloUrl}" target="_blank" rel="noopener" data-zalo>Đặt ngay</a>`}
          </div>`}
      </section>

      <section aria-labelledby="mau-hoa">
        <div class="catalog-head">
          <h2 id="mau-hoa">Mẫu hoa</h2>
          ${products.length > 6 && html`<label class="search">${raw(ICON.search)}<input type="search" id="q" placeholder="Tìm mẫu hoa…" aria-label="Tìm mẫu hoa"></label>`}
          ${cats.length > 1 && html`<div class="pills" id="cats">
            <button class="pill on" data-cat="">Tất cả</button>
            ${cats.map((c) => html`<button class="pill" data-cat="${c}">${c}</button>`)}
          </div>`}
        </div>
        <div class="grid-products" id="grid"></div>
      </section>

      <section class="card custom-card">
        <div class="grow">
          <h2 style="font-family: var(--serif); font-weight: 600; font-size: 20px">Muốn bó hoa theo ý bạn?</h2>
          <div class="muted" style="font-size: 14px">Gửi màu sắc, ngân sách và dịp tặng, shop sẽ tư vấn và báo giá.</div>
        </div>
        ${zaloUrl && html`<a class="btn btn-outline" href="${zaloUrl}" target="_blank" rel="noopener">${raw(ICON.chat)}Nhắn tư vấn</a>`}
      </section>

      <footer class="store-foot">
        <b>${shop.shop_name}</b>
        ${shop.address && html`<a href="${mapUrl}" target="_blank" rel="noopener" style="color: inherit">${shop.address}</a>`}
        ${shop.open_hours && html`<span>Mở cửa: ${shop.open_hours}</span>`}
        ${phone && html`<span>Điện thoại / Zalo: <a href="tel:${phone}">${phoneFmt(phone)}</a></span>`}
      </footer>
    </div>
    ${(zaloUrl || phone) && html`<div class="dock"><div>${contactButtons(false)}</div></div>`}`.s;

  const grid = root.querySelector('#grid');
  function drawGrid() {
    const q = st.q.toLowerCase();
    const shown = products.filter((p) => (!st.cat || p.categories?.includes(st.cat))
      && (!q || `${p.name} ${p.description}`.toLowerCase().includes(q)));
    grid.innerHTML = shown.length ? shown.map((p) => html`
      <button class="p-card" data-pid="${p.id}">
        ${productImage(p, 'p-img')}
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
    const pill = e.target.closest('[data-cat]');
    if (pill) {
      st.cat = pill.dataset.cat;
      root.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', b === pill));
      drawGrid();
      return;
    }
    if (e.target.closest('[data-zalo]')) copyOrder(`Chào ${shop.shop_name}, mình muốn đặt hoa.`);
  });
  root.querySelector('#q')?.addEventListener('input', (e) => { st.q = e.target.value.trim(); drawGrid(); });

  function openDetail(p) {
    const price = priceOf(p, t, shop.holidays);
    sheet({
      title: p.name,
      body: html`
        ${productImage(p, 'detail-img')}
        ${p.categories?.length ? html`<div class="row" style="justify-content: flex-start; flex-wrap: wrap; gap: 6px">${p.categories.map((c) => html`<span class="chip c-rose">${c}</span>`)}</div>` : ''}
        <div class="detail-price">${money(price)}</div>
        ${note(p) && html`<div class="p-note" style="font-size: 13px">${note(p)}</div>`}
        ${p.description && html`<p class="detail-desc">${p.description}</p>`}
        <div class="stack">
          ${zaloUrl && html`<a class="btn btn-primary btn-lg" href="${zaloUrl}" target="_blank" rel="noopener" id="order-zalo">${raw(ICON.chat)}Đặt mẫu này qua Zalo</a>`}
          ${phone && html`<a class="btn btn-lg" href="tel:${phone}">${raw(ICON.phone)}Gọi đặt hoa</a>`}
          ${zaloUrl && html`<div class="tip">Bấm “Đặt qua Zalo”, tên mẫu hoa được chép sẵn để bạn dán vào tin nhắn.</div>`}
        </div>`,
      onMount(dlg) {
        dlg.querySelector('#order-zalo')?.addEventListener('click', () => {
          copyOrder(`Chào ${shop.shop_name}, mình muốn đặt mẫu "${p.name}" (${money(price)}). Shop tư vấn giúp mình nhé!`);
        });
      },
    });
  }

  // Cuộn qua phần đầu trang: hiện tên shop trên thanh trên và thanh nút liên hệ ở đáy.
  const sentinel = root.querySelector('.cta') || root.querySelector('.hero h1');
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
    root.innerHTML = html`<div class="store-wrap" style="padding-top: 48px"><div class="card stack">
      <h2>Chưa tải được mẫu hoa</h2><div class="muted">${errMsg(e)}</div>
      <button class="btn btn-primary" onclick="location.reload()">Thử lại</button></div></div>`.s;
  }
}

start();
