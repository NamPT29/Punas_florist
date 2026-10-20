// Trang cho khách: ảnh bìa lớn, mẫu hoa xếp theo bộ sưu tập (kiểu tạp chí), đặt qua Zalo hoặc gọi điện. Không cần đăng nhập.
import { loadBackend } from './backend.js';
import { html, raw, ICON, money, moneyShort, fold, toast, errMsg, phoneDigits, phoneFmt, today, ddmm, sheet } from './util.js';
import { nextHoliday, priceOf, holidayName, holidayProducts } from './stats.js';

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

const ARROW_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const ARROW_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const CHEVRON = '<svg class="occ-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

// Lọc theo giá (giá đang áp dụng hôm nay).
const PRICE = [
  ['lt', 'Dưới 250k', (v) => v < 250000],
  ['mid', '250k – 400k', (v) => v >= 250000 && v <= 400000],
  ['gt', 'Trên 400k', (v) => v > 400000],
];

function render(root, { shop, products, groups = [], delivered = [] }) {
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
  const st = { occ: '', q: '', price: '' };
  const priceNow = (p) => priceOf(p, t, shop.holidays);
  document.title = `${shop.shop_name} · Mẫu hoa & bảng giá`;

  // Bộ sưu tập = nhóm mẫu chủ shop tạo (giữ thứ tự), trong nhóm xếp giá tăng dần.
  // Mẫu chưa xếp nhóm gom vào "Mẫu khác"; shop chưa có nhóm nào thì hiện một lưới duy nhất.
  const byPrice = (list) => [...list].sort((a, b) => priceNow(a) - priceNow(b) || a.name.localeCompare(b.name, 'vi'));
  const groupIds = new Set(groups.map((g) => String(g.id)));
  let colls = groups
    .map((g) => ({ key: `bst-${g.id}`, name: g.name, items: byPrice(products.filter((p) => p.group_id != null && String(p.group_id) === String(g.id))) }))
    .filter((c) => c.items.length);
  const rest = products.filter((p) => p.group_id == null || !groupIds.has(String(p.group_id)));
  if (colls.length && rest.length) colls.push({ key: 'bst-khac', name: 'Mẫu khác', items: byPrice(rest) });
  const grouped = colls.length > 0;
  if (!grouped) colls = [{ key: 'bst-tat-ca', name: '', items: products, plain: true }];
  const groupOf = new Map(grouped ? colls.flatMap((c) => c.items.map((p) => [p.id, c.name])) : []);
  const collCount = grouped ? colls.length : 0;

  // Bộ sưu tập dịp lễ: trong 14 ngày trước ngày lễ, đưa các mẫu của dịp lên đầu kèm đếm ngược.
  const holItems = holiday ? byPrice(holidayProducts(products, holiday.date)) : [];
  const countdown = !holiday ? '' : holiday.daysLeft === 0 ? 'Hôm nay' : holiday.daysLeft === 1 ? 'Ngày mai' : `Còn ${holiday.daysLeft} ngày`;
  if (holItems.length) {
    colls.unshift({ key: 'bst-le', name: holidayName(holiday.date), nav: `Dịp ${ddmm(holiday.date)}`, items: holItems, hol: true });
    if (!grouped) colls[1].name = 'Tất cả mẫu';
  }
  const showNav = grouped || holItems.length > 0;
  const priceOpts = PRICE.filter(([, , ok]) => products.some((p) => ok(priceNow(p))));

  const note = (p) => (holiday && holiday.daysLeft > 0 && p.holiday_price != null && p.holiday_price !== p.price
    ? `Dịp ${ddmm(holiday.date)}: ${money(p.holiday_price)}` : '');
  const zaloBtn = (cls, label) => zaloUrl
    && html`<a class="btn ${cls}" href="${zaloUrl}" target="_blank" rel="noopener" data-zalo>${raw(ICON.chat)}${label}</a>`;
  const callBtn = (cls, label) => phone && html`<a class="btn ${cls}" href="tel:${phone}">${raw(ICON.phone)}${label}</a>`;
  const summary = (n) => (grouped ? `${n} mẫu · ${collCount} bộ sưu tập` : `${n} mẫu`);

  root.innerHTML = html`
    <div class="topbar"><div class="wrap">
      <span class="tagline">${slogan}</span>
      <span class="contacts">
        ${phone && html`<a href="tel:${phone}">${raw(ICON.phone)}<span>${phoneFmt(phone)}</span></a>`}
        ${zaloUrl && html`<a href="${zaloUrl}" target="_blank" rel="noopener" data-zalo>${raw(ICON.chat)}<span>Zalo</span></a>`}
      </span>
    </div></div>

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
      ${holiday && !holItems.length && html`
        <div class="season">
          <div><b>${holiday.daysLeft === 0 ? `Hôm nay là ${ddmm(holiday.date)}` : `Đặt trước hoa ${ddmm(holiday.date)}`}</b>
            <span>${holiday.daysLeft === 0 ? 'Shop vẫn nhận đơn giao trong ngày.' : `Còn ${holiday.daysLeft} ngày. Đặt sớm để giữ mẫu và giờ giao.`}</span></div>
          ${zaloBtn('btn-primary btn-sm', 'Đặt ngay')}
        </div>`}

      <section class="catalog" id="mau-hoa" aria-labelledby="cat-title">
        <div class="catalog-head">
          <div>
            <div class="kicker">Bộ sưu tập</div>
            <h2 id="cat-title">Mẫu hoa</h2>
            <p class="catalog-sub" id="cat-sub">${summary(products.length)}</p>
          </div>
          ${(cats.length > 0 || products.length > 6) && html`<div class="catalog-tools">
            ${cats.length > 0 && html`<label class="occ"><span class="occ-lab">Dịp</span>
              <select id="occ" aria-label="Lọc theo dịp tặng"><option value="">Tất cả</option>${cats.map((c) => html`<option value="${c}">${c}</option>`)}</select>${raw(CHEVRON)}</label>`}
            ${products.length > 6 && html`<label class="search">${raw(ICON.search)}<input type="search" id="q" placeholder="Tìm mẫu hoa…" aria-label="Tìm mẫu hoa"></label>`}
          </div>`}
        </div>
        ${priceOpts.length > 1 && html`<div class="price-filter" role="group" aria-label="Lọc theo giá">
          <button type="button" class="on" data-price="" aria-pressed="true">Mọi giá</button>
          ${priceOpts.map(([k, label]) => html`<button type="button" data-price="${k}" aria-pressed="false">${label}</button>`)}
        </div>`}
        ${showNav && html`<nav class="coll-nav" id="coll-nav" aria-label="Chọn bộ sưu tập"></nav>`}
        <div id="colls"></div>
      </section>

      ${delivered.length > 0 && html`
        <section class="delivered" aria-labelledby="dlv-title">
          <div class="kicker">Khách đã nhận</div>
          <h2 id="dlv-title">Hoa đã giao</h2>
          <p class="catalog-sub">Ảnh chụp thật trước khi giao cho khách.</p>
          <div class="dlv-row">
            ${delivered.map((d, i) => html`<button type="button" class="dlv" data-dlv="${i}"><img src="${d.photo_url}" alt="${d.items || 'Bó hoa đã giao'}" loading="lazy"><span class="dlv-cap">${d.items}</span></button>`)}
          </div>
        </section>`}

      <section class="howto" aria-labelledby="howto-title">
        <h2 id="howto-title">Cách đặt hoa</h2>
        <ol class="steps">
          ${STEPS.map(([title, text], i) => html`<li class="step"><span class="step-no">0${i + 1}</span><span><b>${title}</b><span class="step-text">${text}</span></span></li>`)}
        </ol>
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

  const body = root.querySelector('#colls');
  const nav = root.querySelector('#coll-nav');
  const card = (p) => html`
    <button class="p-card" data-pid="${p.id}">
      <span class="p-media">${productImage(p, 'p-img')}</span>
      <span class="p-body">
        <span class="p-name">${p.name}</span>
        <span class="p-foot"><span class="p-price">${money(priceNow(p))}</span>
        ${note(p) && html`<span class="p-note">${note(p)}</span>`}</span>
      </span>
    </button>`;

  let spy;
  function setActive(key) {
    if (!nav) return;
    for (const a of nav.querySelectorAll('a')) {
      const on = a.dataset.coll === key;
      a.classList.toggle('on', on);
      if (on) {
        a.setAttribute('aria-current', 'true');
        if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: Math.max(0, a.offsetLeft - 20), behavior: 'smooth' });
      } else a.removeAttribute('aria-current');
    }
  }

  // Hàng ngang: hiện nút mũi tên (máy tính) khi còn mẫu bị khuất, mờ nút khi đã tới đầu/cuối.
  function updateRail(row) {
    const btns = row.closest('.coll').querySelector('.rail-btns');
    const max = row.scrollWidth - row.clientWidth;
    btns.hidden = max <= 4;
    btns.querySelector('[data-rail="-1"]').disabled = row.scrollLeft <= 4;
    btns.querySelector('[data-rail="1"]').disabled = row.scrollLeft >= max - 4;
  }
  window.addEventListener('resize', () => body.querySelectorAll('.coll-row').forEach(updateRail));

  function draw() {
    const q = fold(st.q);
    const price = PRICE.find(([k]) => k === st.price);
    const match = (p) => (!st.occ || p.categories?.includes(st.occ)) && (!price || price[2](priceNow(p)))
      && (!q || fold(`${p.name} ${p.description}`).includes(q));
    const shown = colls.map((c) => ({ ...c, items: c.items.filter(match) })).filter((c) => c.items.length);
    // Mẫu dịp lễ cũng nằm trong bộ sưu tập của nó: không đếm hai lần.
    const n = new Set(shown.filter((c) => !c.hol).flatMap((c) => c.items.map((p) => p.id))).size;
    const filters = [st.occ, price?.[1]].filter(Boolean).join(' · ');
    root.querySelector('#cat-sub').textContent = filters || q ? `${filters ? `${filters} · ` : ''}${n} mẫu phù hợp` : summary(n);
    body.innerHTML = shown.length ? shown.map((c) => html`
      <section class="coll${c.plain ? ' plain' : ''}${c.hol ? ' hol' : ''}" id="${c.key}" ${raw(c.name ? `aria-labelledby="${c.key}-t"` : 'aria-label="Mẫu hoa"')}>
        ${c.name && html`
          <header class="coll-head">
            ${c.hol && html`<span class="hol-badge">${countdown}</span>`}
            <h3 id="${c.key}-t">${c.name}</h3>
            <span class="coll-meta">${c.items.length} mẫu · từ ${moneyShort(Math.min(...c.items.map(priceNow)))}</span>
            ${c.hol && zaloBtn('btn-primary btn-sm hol-cta', holiday.daysLeft ? 'Đặt trước qua Zalo' : 'Đặt ngay qua Zalo')}
            ${!c.plain && html`<span class="rail-btns" hidden>
              <button type="button" class="rail-btn" data-rail="-1" aria-label="Mẫu trước">${raw(ARROW_L)}</button>
              <button type="button" class="rail-btn" data-rail="1" aria-label="Mẫu tiếp">${raw(ARROW_R)}</button>
            </span>`}
          </header>`}
        ${c.plain ? html`<div class="grid-products">${c.items.map(card)}</div>` : html`<div class="coll-row">${c.items.map(card)}</div>`}
      </section>`.s).join('')
      : html`<div class="empty-note">${products.length
        ? html`Không có mẫu phù hợp. <button class="linkish" data-reset>Xem tất cả mẫu</button>`
        : 'Shop đang cập nhật mẫu hoa. Nhắn Zalo để được tư vấn nhé!'}</div>`.s;

    body.querySelectorAll('.coll-row').forEach((row) => {
      updateRail(row);
      row.addEventListener('scroll', () => updateRail(row), { passive: true });
    });

    if (nav) {
      nav.innerHTML = shown.filter((c) => c.name).map((c) => html`<a href="#${c.key}" data-coll="${c.key}">${c.nav || c.name}</a>`.s).join('');
      nav.hidden = shown.length < 2;
      spy?.disconnect();
      if (shown.length) setActive(shown[0].key);
      if ('IntersectionObserver' in window) {
        spy = new IntersectionObserver((entries) => {
          for (const en of entries) if (en.isIntersecting) setActive(en.target.id);
        }, { rootMargin: '-25% 0px -65% 0px' });
        body.querySelectorAll('.coll').forEach((el) => spy.observe(el));
      }
    }
  }

  // Zalo không cho điền sẵn tin nhắn qua link: chép sẵn nội dung để khách dán vào.
  const copyOrder = (text) => {
    navigator.clipboard?.writeText(text).then(() => toast('Đã chép tên mẫu hoa, dán vào Zalo để nhắn shop'), () => {});
  };
  root.addEventListener('click', (e) => {
    const pc = e.target.closest('[data-pid]');
    if (pc) { openDetail(products.find((p) => String(p.id) === pc.dataset.pid)); return; }
    const dlv = e.target.closest('[data-dlv]');
    if (dlv) { openDelivered(delivered[Number(dlv.dataset.dlv)]); return; }
    const pf = e.target.closest('[data-price]');
    if (pf) { setPrice(pf.dataset.price); draw(); return; }
    const rail = e.target.closest('[data-rail]');
    if (rail) {
      const row = rail.closest('.coll').querySelector('.coll-row');
      row.scrollBy({ left: Number(rail.dataset.rail) * row.clientWidth * 0.9, behavior: 'smooth' });
      return;
    }
    const link = e.target.closest('[data-coll]');
    if (link) {
      e.preventDefault();
      setActive(link.dataset.coll);
      root.querySelector(`#${link.dataset.coll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('[data-reset]')) {
      st.occ = ''; st.q = '';
      setPrice('');
      const occ = root.querySelector('#occ'); if (occ) occ.value = '';
      const qi = root.querySelector('#q'); if (qi) qi.value = '';
      draw();
      return;
    }
    if (e.target.closest('[data-zalo]')) copyOrder(`Chào ${shop.shop_name}, mình muốn đặt hoa.`);
  });
  function setPrice(key) {
    st.price = key;
    root.querySelectorAll('[data-price]').forEach((b) => {
      b.classList.toggle('on', b.dataset.price === key);
      b.setAttribute('aria-pressed', String(b.dataset.price === key));
    });
  }
  root.querySelector('#occ')?.addEventListener('change', (e) => { st.occ = e.target.value; draw(); });
  root.querySelector('#q')?.addEventListener('input', (e) => { st.q = e.target.value.trim(); draw(); });

  // Ảnh "Hoa đã giao": xem lớn, đặt bó tương tự qua Zalo.
  function openDelivered(d) {
    sheet({
      title: 'Hoa đã giao',
      wide: true,
      body: html`<div class="detail-layout">
        <div class="detail-frame"><img class="detail-img" src="${d.photo_url}" alt="${d.items || 'Bó hoa đã giao'}"></div>
        <div class="stack detail-info">
          ${d.month && html`<div class="kicker">Tháng ${d.month}</div>`}
          ${d.items && html`<p class="detail-desc">${d.items}</p>`}
          <p class="muted small">Ảnh chụp thật trước khi giao. Hoa theo mùa nên bó của bạn có thể khác đôi chút về màu và số bông.</p>
          ${zaloUrl && html`<a class="btn btn-primary btn-lg" href="${zaloUrl}" target="_blank" rel="noopener" id="order-like">${raw(ICON.chat)}Đặt bó tương tự qua Zalo</a>`}
          ${phone && html`<a class="btn btn-lg" href="tel:${phone}">${raw(ICON.phone)}Gọi đặt hoa</a>`}
        </div></div>`,
      onMount(dlg) {
        dlg.querySelector('#order-like')?.addEventListener('click', () => {
          copyOrder(`Chào ${shop.shop_name}, mình muốn đặt bó giống ảnh "Hoa đã giao"${d.items ? ` (${d.items})` : ''}. Shop tư vấn giúp mình nhé!`);
        });
      },
    });
  }

  function openDetail(p) {
    const price = priceNow(p);
    const gname = groupOf.get(p.id);
    sheet({
      title: p.name,
      wide: true,
      body: html`<div class="detail-layout">
        <div class="detail-frame">${productImage(p, 'detail-img')}</div>
        <div class="stack detail-info">
        ${gname && html`<div class="kicker">Bộ sưu tập · ${gname}</div>`}
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

  draw();
}

async function start() {
  const root = document.getElementById('store');
  try {
    const db = await loadBackend();
    if (db.mode === 'demo') {
      const note = document.getElementById('demo');
      note.textContent = `Bản dùng thử · dữ liệu mẫu lưu tại địa chỉ ${location.host}`;
      note.classList.remove('hidden');
    }
    render(root, await db.publicCatalog());
  } catch (e) {
    console.error(e);
    root.innerHTML = html`<div class="wrap" style="padding-top: 48px"><div class="card stack">
      <h2>Chưa tải được mẫu hoa</h2><div class="muted">${errMsg(e)}</div>
      <button class="btn btn-primary" onclick="location.reload()">Thử lại</button></div></div>`.s;
  }
}

start();
