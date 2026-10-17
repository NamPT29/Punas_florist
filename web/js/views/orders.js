// Đơn hàng: danh sách, tạo đơn, chi tiết đơn.
import { app, refresh, setQuery } from '../app.js';
import {
  html, raw, ICON, money, num, today, addDays, ddmm, dateShort, dateLong, dateRelative, phoneDigits, phoneFmt,
  parseMoney, bindMoneyInputs, STATUS, PAYMENT, statusChip, toast, errMsg, sheet, shrinkImage, itemsLabel,
} from '../util.js';
import { nextHoliday, priceOf, sortOrders } from '../stats.js';

const SLOTS = ['08–10h', '10–12h', '12–14h', '14–16h', '16–18h', '18–20h'];
const STATUS_ORDER = ['moi', 'dang_cam', 'dang_giao', 'da_giao', 'huy'];

function orderCard(o, showDate) {
  const pay = o.paid
    ? html`<span class="small pos strong">${o.payment_method === 'tien_mat' ? 'Đã trả tiền mặt' : `Đã ${PAYMENT[o.payment_method]?.toLowerCase() || 'trả'}`}</span>`
    : html`<span class="small neg strong">${o.status === 'dang_giao' && !o.pickup ? 'Thu hộ' : 'Chưa thanh toán'}</span>`;
  return html`
    <a class="card order-card ${['da_giao', 'huy'].includes(o.status) ? 'done' : ''}" href="#/don/${o.id}">
      <div class="row">
        <div class="strong">${showDate ? `${dateRelative(o.delivery_date)} · ` : ''}${o.delivery_slot || 'Chưa hẹn giờ'} <span class="muted" style="font-weight: 500">· #${o.id}</span></div>
        ${statusChip(o.status)}
      </div>
      <div class="name">${itemsLabel(o)}</div>
      <div class="muted">${o.pickup ? `Lấy tại shop · ${o.customer?.name || ''}` : `Nhận: ${o.recipient_name}${o.address ? ` · ${o.address}` : ''}`}</div>
      <div class="row" style="margin-top: 8px"><b>${money(o.total)}</b>${pay}</div>
    </a>`;
}

const matches = (o, q) => {
  const s = q.toLowerCase();
  const digits = phoneDigits(q);
  return [o.customer?.name, o.recipient_name, o.address, itemsLabel(o), `#${o.id}`].some((v) => v?.toLowerCase().includes(s))
    || (digits.length >= 3 && [o.customer?.phone, o.recipient_phone].some((p) => p?.includes(digits)));
};

// ===================== Danh sách =====================
export async function list({ el, query }) {
  const { db, settings } = app;
  const t = today();
  const d = query.d || 'today';
  const holiday = nextHoliday(settings?.holidays, t, 30);
  let orders;
  if (d === 'upcoming') orders = await db.listOrders({ from: t, limit: 500 });
  else if (d === 'no') orders = await db.listOrders({ unpaidOnly: true, limit: 1000 });
  else if (d === 'past') orders = await db.listOrders({ from: addDays(t, -60), to: addDays(t, -1), newestFirst: true });
  else {
    const date = d === 'today' ? t : d === 'tomorrow' ? addDays(t, 1) : d;
    orders = await db.listOrders({ from: date, to: date });
  }
  const multiDay = ['upcoming', 'no', 'past'].includes(d);
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, orders.filter((o) => o.status === s).length]));
  const status = query.s || '';
  const custom = !['today', 'tomorrow', 'upcoming', 'no', 'past'].includes(d) && d !== holiday?.date;

  const datePill = (key, label) => html`<button class="pill ${d === key ? 'on' : ''}" data-d="${key}">${label}</button>`;
  el.innerHTML = html`
    <header class="top" style="flex-direction: column; align-items: stretch; gap: 12px">
      <h1>Đơn hàng</h1>
      <label class="search">${raw(ICON.search)}<input type="search" id="q" placeholder="Tìm tên, SĐT, mã đơn…" aria-label="Tìm đơn" value="${query.q || ''}"></label>
      <div class="pills">
        ${datePill('today', 'Hôm nay')}
        ${datePill('tomorrow', 'Ngày mai')}
        ${holiday && holiday.daysLeft > 1 ? datePill(holiday.date, `Lễ ${ddmm(holiday.date)}`) : ''}
        ${datePill('upcoming', 'Sắp tới')}
        ${datePill('no', 'Chưa trả tiền')}
        ${datePill('past', 'Đã qua')}
        <label class="pill ${custom ? 'on' : ''}">${custom ? dateShort(d) : 'Chọn ngày'}<input type="date" id="pick-date" aria-label="Chọn ngày giao" value="${custom ? d : ''}"></label>
      </div>
      <div class="pills" id="status-pills">
        <button class="pill ${!status ? 'on' : ''}" data-s="">Tất cả ${orders.length}</button>
        ${STATUS_ORDER.filter((s) => counts[s]).map((s) => html`<button class="pill ${status === s ? 'on' : ''}" data-s="${s}">${STATUS[s].label} ${counts[s]}</button>`)}
      </div>
    </header>
    <div class="page" id="order-list"></div>`.s;

  const listEl = el.querySelector('#order-list');
  let searchPool = null;
  const draw = (rows, showDate) => {
    listEl.innerHTML = rows.length
      ? rows.map((o) => orderCard(o, showDate).s).join('')
      : html`<div class="card empty">Không có đơn nào.<br><a class="btn btn-outline" href="#/don/moi">+ Tạo đơn</a></div>`.s;
  };
  const shown = () => (status ? orders.filter((o) => o.status === status) : orders);
  const drawDefault = () => draw(d === 'past' ? shown() : sortOrders(shown()), multiDay);

  async function search(q) {
    if (!q.trim()) { drawDefault(); return; }
    searchPool ??= await db.listOrders({ newestFirst: true, limit: 1000 });
    draw(searchPool.filter((o) => matches(o, q.trim())), true);
  }
  let timer;
  el.querySelector('#q').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => search(e.target.value).catch((err) => toast(errMsg(err), 'error')), 250);
  });
  el.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => setQuery({ d: b.dataset.d, s: '', q: '' }); });
  el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => setQuery({ s: b.dataset.s }); });
  el.querySelector('#pick-date').addEventListener('change', (e) => { if (e.target.value) setQuery({ d: e.target.value, s: '' }); });
  if (query.q) await search(query.q); else drawDefault();
}

// ===================== Tạo đơn =====================
export async function create({ el, query }) {
  const { db, settings } = app;
  const t = today();
  const [products, customers] = await Promise.all([db.listProducts(), db.listCustomers()]);
  const activeProducts = products.filter((p) => p.active);
  const holidays = settings?.holidays || [];
  const defaultShip = Number(settings?.default_ship_fee) || 0;

  const st = {
    phone: '', name: '', pickup: false, other: false, rName: '', rPhone: '', address: '', anonymous: false,
    date: t, slot: '', time: '', items: [], card: '', note: '', ship: defaultShip, discount: 0, pay: 'none', handover: false,
  };
  // Tạo đơn cho khách có sẵn, hoặc đặt lại một đơn cũ.
  if (query.from) {
    const old = await db.getOrder(Number(query.from));
    Object.assign(st, {
      phone: old.customer?.phone || '', name: old.customer?.name || '', pickup: old.pickup,
      other: old.recipient_phone !== old.customer?.phone, rName: old.recipient_name, rPhone: old.recipient_phone,
      address: old.address, anonymous: old.anonymous, card: old.card_message,
      items: old.items.filter((i) => activeProducts.some((p) => p.id === i.product_id) || i.product_id == null)
        .map((i) => ({ product_id: i.product_id, name: i.name, price: i.product_id == null ? i.price : null, qty: i.qty })),
    });
  } else if (query.phone) {
    const c = customers.find((x) => x.phone === phoneDigits(query.phone));
    if (c) Object.assign(st, { phone: c.phone, name: c.name, address: c.address });
  }

  const productOf = (id) => products.find((p) => p.id === id);
  const itemPrice = (it) => (it.product_id == null ? it.price : priceOf(productOf(it.product_id), st.date, holidays));
  const subtotal = () => st.items.reduce((s, it) => s + itemPrice(it) * it.qty, 0);
  const total = () => Math.max(subtotal() + (st.pickup ? 0 : st.ship) - st.discount, 0);

  el.innerHTML = html`
    <header class="top-nav">
      <a class="back" href="#/don">Hủy</a>
      <h1>${query.from ? 'Đặt lại đơn' : 'Tạo đơn mới'}</h1>
      <span style="width: 52px"></span>
    </header>
    <form class="page" id="f" novalidate>
      <section class="card stack">
        <h2>Khách đặt</h2>
        <label class="field">Số điện thoại<input name="phone" type="tel" inputmode="tel" autocomplete="off" value="${phoneFmt(st.phone)}" placeholder="0903 123 456"></label>
        <div id="cust-hint"></div>
        <label class="field">Tên khách<input name="name" value="${st.name}" autocomplete="off" placeholder="VD: Anh Tuấn"></label>
      </section>

      <section class="card stack">
        <div class="opts" style="grid-template-columns: 1fr 1fr">
          <button type="button" class="opt" data-pickup="0">Giao hàng</button>
          <button type="button" class="opt" data-pickup="1">Khách lấy tại shop</button>
        </div>
        <div id="delivery-fields" class="stack">
          <label class="check"><input type="checkbox" name="other" ${st.other ? 'checked' : ''}>Người nhận khác người đặt</label>
          <div id="recipient" class="grid2">
            <label class="field">Tên người nhận<input name="rName" value="${st.rName}" autocomplete="off"></label>
            <label class="field">SĐT người nhận<input name="rPhone" type="tel" inputmode="tel" value="${phoneFmt(st.rPhone)}" autocomplete="off"></label>
          </div>
          <label class="field">Địa chỉ giao<input name="address" value="${st.address}" placeholder="Số nhà, đường, phường, quận"></label>
          <label class="check"><input type="checkbox" name="anonymous" ${st.anonymous ? 'checked' : ''}>Giấu tên người gửi</label>
        </div>
        <label class="check hidden" id="handover"><input type="checkbox" name="handover">Khách nhận luôn (bán tại quầy)</label>
      </section>

      <section class="card stack" id="when">
        <h2>Thời gian giao</h2>
        <div class="opts" id="date-opts"></div>
        <div class="opts" id="slot-opts"></div>
        <input class="inp hidden" type="time" name="time" id="time" aria-label="Giờ giao cụ thể" value="${st.time}">
      </section>

      <section class="card stack">
        <h2>Sản phẩm</h2>
        <div id="items" class="stack"></div>
        <button type="button" class="btn btn-dashed" id="add-item">+ Thêm sản phẩm</button>
        <label class="field">Lời nhắn trên thiệp<textarea name="card" rows="2" placeholder="VD: Chúc em sinh nhật vui vẻ!">${st.card}</textarea></label>
        <label class="field">Ghi chú cho thợ cắm<input name="note" placeholder="VD: giấy gói màu kem" value="${st.note}"></label>
      </section>

      <section class="card stack">
        <h2>Thanh toán</h2>
        <div class="money-row muted" style="font-size: 14px"><span>Tạm tính</span><span id="subtotal"></span></div>
        <div class="money-row" id="ship-row"><label for="ship" class="muted" style="font-size: 14px">Phí ship</label><input class="inp" id="ship" name="ship" data-money inputmode="numeric" value="${st.ship ? num(st.ship) : ''}" placeholder="0"></div>
        <div class="money-row"><label for="discount" class="muted" style="font-size: 14px">Giảm giá</label><input class="inp" id="discount" name="discount" data-money inputmode="numeric" placeholder="0"></div>
        <div class="row" style="border-top: 1px solid var(--line); padding-top: 10px"><b>Tổng cộng</b><b style="font-size: 20px" id="total"></b></div>
        <div class="opts" style="grid-template-columns: 1fr 1fr" id="pay-opts">
          <button type="button" class="opt" data-pay="none">Chưa thanh toán</button>
          <button type="button" class="opt" data-pay="tien_mat">Tiền mặt</button>
          <button type="button" class="opt" data-pay="chuyen_khoan">Chuyển khoản</button>
          <button type="button" class="opt" data-pay="the">Thẻ / Ví</button>
        </div>
      </section>
    </form>
    <div class="footer-bar"><div><button class="btn btn-primary btn-lg btn-block" id="save" type="button">Lưu đơn</button></div></div>`.s;

  const f = el.querySelector('#f');
  f.addEventListener('submit', (e) => e.preventDefault());
  bindMoneyInputs(el);
  const $ = (sel) => el.querySelector(sel);

  function drawCustomerHint() {
    const digits = phoneDigits(st.phone);
    const c = digits.length >= 9 ? customers.find((x) => x.phone === digits) : null;
    $('#cust-hint').innerHTML = c
      ? html`<div class="hint">Khách cũ: <b>${c.name}</b> · ${c.order_count} đơn${c.last_order_date ? ` · gần nhất ${ddmm(c.last_order_date)}` : ''}${c.debt ? html` · <span class="neg">nợ ${money(c.debt)}</span>` : ''}${c.note ? html`<br><i>${c.note}</i>` : ''}</div>`.s
      : '';
    return c;
  }
  function drawMode() {
    el.querySelectorAll('[data-pickup]').forEach((b) => b.classList.toggle('on', (b.dataset.pickup === '1') === st.pickup));
    $('#delivery-fields').classList.toggle('hidden', st.pickup);
    $('#ship-row').classList.toggle('hidden', st.pickup);
    $('#recipient').classList.toggle('hidden', !st.other);
    $('#handover').classList.toggle('hidden', !st.pickup || st.date !== t);
    $('#when').classList.toggle('hidden', st.pickup && st.handover && st.date === t);
  }
  function drawWhen() {
    const opts = [[t, 'Hôm nay'], [addDays(t, 1), 'Ngày mai'], [addDays(t, 2), dateShort(addDays(t, 2))]];
    const hol = nextHoliday(holidays, t, 30);
    if (hol && hol.daysLeft > 2) opts.push([hol.date, `Lễ ${ddmm(hol.date)}`]);
    const isCustom = !opts.some(([d]) => d === st.date);
    $('#date-opts').innerHTML = html`
      ${opts.map(([d, label]) => html`<button type="button" class="opt ${st.date === d ? 'on' : ''}" data-date="${d}">${label}</button>`)}
      <label class="opt ${isCustom ? 'on' : ''}">${isCustom ? dateShort(st.date) : 'Chọn ngày'}<input type="date" id="date-pick" value="${st.date}" min="${t}" aria-label="Chọn ngày giao"></label>`.s;
    const custom = st.slot === 'time';
    $('#slot-opts').innerHTML = html`
      ${SLOTS.map((s) => html`<button type="button" class="opt ${st.slot === s ? 'on' : ''}" data-slot="${s}">${s}</button>`)}
      <button type="button" class="opt ${custom ? 'on' : ''}" data-slot="time">Giờ cụ thể</button>
      <button type="button" class="opt ${st.slot === '' ? 'on' : ''}" data-slot="">Chưa hẹn</button>`.s;
    $('#time').classList.toggle('hidden', !custom);
  }
  function drawItems() {
    $('#items').innerHTML = st.items.length ? st.items.map((it, i) => {
      const p = it.product_id != null ? productOf(it.product_id) : null;
      const price = itemPrice(it);
      return html`
        <div class="row">
          ${p?.photo_url ? html`<img class="thumb" src="${p.photo_url}" alt="">` : html`<div class="thumb"></div>`}
          <div class="grow"><div class="strong" style="font-size: 14px">${it.name}</div>
            <div class="muted">${money(price)}${p && price !== p.price ? html` <span class="chip c-rose">giá lễ</span>` : ''}</div></div>
          <div class="stepper"><button type="button" data-dec="${i}" aria-label="Giảm">−</button><b>${it.qty}</b><button type="button" data-inc="${i}" aria-label="Tăng">+</button></div>
        </div>`.s;
    }).join('') : '<div class="muted">Chưa chọn sản phẩm.</div>';
    drawTotals();
  }
  function drawTotals() {
    $('#subtotal').textContent = money(subtotal());
    $('#total').textContent = money(total());
    $('#save').textContent = `Lưu đơn · ${money(total())}`;
    el.querySelectorAll('[data-pay]').forEach((b) => b.classList.toggle('on', b.dataset.pay === st.pay));
  }

  f.addEventListener('input', (e) => {
    const { name, value, checked, type } = e.target;
    if (!name) return;
    if (name === 'ship' || name === 'discount') st[name] = parseMoney(value);
    else if (type === 'checkbox') st[name] = checked;
    else st[name] = value;
    if (name === 'phone') {
      const c = drawCustomerHint();
      if (c) {
        if (!st.name) { st.name = c.name; f.elements.name.value = c.name; }
        if (!st.address && c.address) { st.address = c.address; f.elements.address.value = c.address; }
      }
    }
    if (['other', 'handover'].includes(name)) drawMode();
    drawTotals();
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.pickup) { st.pickup = b.dataset.pickup === '1'; if (!st.pickup) st.handover = false; drawMode(); drawTotals(); }
    else if (b.dataset.date) { st.date = b.dataset.date; drawWhen(); drawMode(); drawItems(); }
    else if ('slot' in b.dataset) { st.slot = b.dataset.slot; drawWhen(); }
    else if (b.dataset.pay) { st.pay = b.dataset.pay; drawTotals(); }
    else if (b.dataset.inc) { st.items[b.dataset.inc].qty++; drawItems(); }
    else if (b.dataset.dec) {
      const it = st.items[b.dataset.dec];
      if (--it.qty <= 0) st.items.splice(Number(b.dataset.dec), 1);
      drawItems();
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.id === 'date-pick' && e.target.value) { st.date = e.target.value; drawWhen(); drawMode(); drawItems(); }
  });
  $('#add-item').onclick = () => pickProduct(activeProducts, st.date, holidays, (it) => {
    const same = it.product_id != null && st.items.find((x) => x.product_id === it.product_id);
    if (same) same.qty++;
    else st.items.push(it);
    drawItems();
  });

  $('#save').onclick = async () => {
    const btn = $('#save');
    const counterSale = st.pickup && st.handover && st.date === t;
    const slot = counterSale ? '' : st.slot === 'time' ? st.time : st.slot;
    if (st.items.length === 0) return toast('Chưa chọn sản phẩm', 'error');
    btn.disabled = true;
    try {
      const id = await db.createOrder({
        customer_name: st.name, customer_phone: st.phone, pickup: st.pickup,
        recipient_name: st.other ? st.rName : st.name, recipient_phone: st.other ? st.rPhone : st.phone,
        address: st.pickup ? '' : st.address, anonymous: st.anonymous, delivery_date: st.date, delivery_slot: slot,
        card_message: st.card, note: st.note, ship_fee: st.pickup ? 0 : st.ship, discount: st.discount,
        paid: st.pay !== 'none', payment_method: st.pay === 'none' ? 'tien_mat' : st.pay,
        status: counterSale ? 'da_giao' : 'moi',
        items: st.items.map((it) => (it.product_id != null ? { product_id: it.product_id, qty: it.qty } : { name: it.name, price: it.price, qty: it.qty })),
      });
      toast(counterSale ? 'Đã bán xong' : 'Đã lưu đơn');
      location.replace(`#/don/${id}`);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      btn.disabled = false;
    }
  };

  drawCustomerHint();
  drawMode();
  drawWhen();
  drawItems();
}

function pickProduct(products, date, holidays, onPick) {
  const body = html`
    <label class="search">${raw(ICON.search)}<input type="search" id="pq" placeholder="Tìm sản phẩm…" aria-label="Tìm sản phẩm"></label>
    <div class="list" id="plist">
      ${products.map((p) => html`
        <button type="button" class="item" data-pid="${p.id}" data-name="${p.name.toLowerCase()}">
          ${p.photo_url ? html`<img class="thumb" src="${p.photo_url}" alt="">` : html`<div class="thumb"></div>`}
          <div class="grow"><div class="title">${p.name}</div><div class="muted">${p.categories?.join(' · ')}</div></div>
          <b class="nowrap">${money(priceOf(p, date, holidays))}</b>
        </button>`)}
      ${products.length ? '' : html`<div class="empty">Chưa có sản phẩm. Thêm ở mục Thêm › Sản phẩm.</div>`}
    </div>
    <div class="card stack">
      <h2>Sản phẩm tùy chọn</h2>
      <div class="muted">Bó theo yêu cầu, quà kèm, thiệp… (không trừ kho)</div>
      <label class="field">Tên<input id="cname" placeholder="VD: Bó tùy chọn tông trắng"></label>
      <label class="field">Giá<input id="cprice" data-money inputmode="numeric" placeholder="0"></label>
      <button type="button" class="btn btn-outline" id="cadd">Thêm vào đơn</button>
    </div>`;
  sheet({
    title: 'Chọn sản phẩm', body,
    onMount(dlg, close) {
      dlg.querySelector('#pq').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        dlg.querySelectorAll('[data-pid]').forEach((b) => b.classList.toggle('hidden', !b.dataset.name.includes(q)));
      });
      dlg.querySelectorAll('[data-pid]').forEach((b) => {
        b.onclick = () => {
          const p = products.find((x) => x.id === Number(b.dataset.pid));
          onPick({ product_id: p.id, name: p.name, price: null, qty: 1 });
          close();
        };
      });
      dlg.querySelector('#cadd').onclick = () => {
        const name = dlg.querySelector('#cname').value.trim();
        const price = parseMoney(dlg.querySelector('#cprice').value);
        if (!name) return toast('Nhập tên sản phẩm', 'error');
        onPick({ product_id: null, name, price, qty: 1 });
        close();
      };
    },
  });
}

// ===================== Chi tiết đơn =====================
export async function detail({ el, params }) {
  const { db, settings } = app;
  const o = await db.getOrder(Number(params[0]));
  const ended = ['da_giao', 'huy'].includes(o.status);
  const flow = ['moi', 'dang_cam', 'dang_giao', 'da_giao'];
  const idx = flow.indexOf(o.status);
  const next = STATUS[o.status]?.next;
  const rPhone = phoneDigits(o.recipient_phone);
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(o.address)}`;

  el.innerHTML = html`
    <header class="top-nav no-print">
      <a class="back" href="#/don">${raw(ICON.back)}Đơn hàng</a>
      <h1>Đơn #${o.id}</h1>
      <button class="icon-btn plain" id="print" aria-label="In phiếu">${raw(ICON.print)}</button>
    </header>
    <div class="print-only" style="padding: 16px"><h1>${settings?.shop_name || ''}</h1><div>${settings?.phone || ''} ${settings?.address || ''}</div><h2 style="margin-top: 8px">Phiếu đơn #${o.id}</h2></div>
    <div class="page">
      ${o.status === 'huy' ? html`<div class="card" style="text-align: center"><span class="chip">Đơn đã hủy</span></div>` : html`
        <div class="card progress no-print">
          ${flow.map((s, i) => html`
            ${i > 0 ? html`<div class="bar ${i <= idx ? 'done' : ''}"></div>` : ''}
            <div class="step ${i < idx || o.status === 'da_giao' ? 'done' : i === idx ? 'now' : ''}"><div class="dot">${i < idx || o.status === 'da_giao' ? '✓' : i + 1}</div>${STATUS[s].label}</div>`)}
        </div>`}

      <section class="card stack">
        <div class="row"><div class="label-up" style="margin: 0">${o.pickup ? 'Khách lấy tại shop' : 'Giao hàng'}</div>${!ended ? html`<button class="link-btn no-print" id="edit-delivery">Sửa</button>` : ''}</div>
        <div style="font-size: 17px; font-weight: 700">${dateLong(o.delivery_date)}${o.delivery_slot ? ` · ${o.delivery_slot}` : ''}</div>
        ${!o.pickup && html`
          <div><b>${o.recipient_name}</b> · ${phoneFmt(o.recipient_phone)}</div>
          ${o.address ? html`<div class="muted" style="font-size: 14px">${o.address}</div>` : ''}
          <div class="btns no-print">
            <a class="btn" href="tel:${rPhone}">${raw(ICON.phone)}Gọi</a>
            <a class="btn" href="https://zalo.me/${rPhone}" target="_blank" rel="noopener">Zalo</a>
            ${o.address ? html`<a class="btn" href="${mapUrl}" target="_blank" rel="noopener">Bản đồ</a>` : ''}
          </div>
          <div class="row no-print">
            <label for="shipper" class="muted" style="font-size: 14px">Shipper</label>
            <input class="inp" id="shipper" list="shippers" value="${o.shipper}" placeholder="Tên shipper / Grab…" style="max-width: 210px" ${ended ? 'disabled' : ''}>
            <datalist id="shippers"><option value="Grab"></option><option value="Ahamove"></option><option value="Be"></option></datalist>
          </div>
          <button class="btn btn-outline no-print" id="share-ship">${raw(ICON.share)}Gửi thông tin cho shipper</button>`}
      </section>

      <section class="card stack">
        <div class="label-up" style="margin: 0">Người đặt</div>
        <div class="row">
          <div><b>${o.customer?.name}</b> · ${phoneFmt(o.customer?.phone)}${o.anonymous ? html` <span class="chip">Giấu tên</span>` : ''}</div>
          <a class="link-btn no-print" href="#/khach/${o.customer_id}">Hồ sơ</a>
        </div>
      </section>

      <section class="card stack">
        <div class="label-up" style="margin: 0">Sản phẩm</div>
        ${o.items.map((i) => html`<div class="row" style="font-size: 14px"><span>${i.name} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`)}
        ${o.ship_fee > 0 && html`<div class="row muted" style="font-size: 14px"><span>Phí ship</span><span>${money(o.ship_fee)}</span></div>`}
        ${o.discount > 0 && html`<div class="row muted" style="font-size: 14px"><span>Giảm giá</span><span>−${money(o.discount)}</span></div>`}
        <div class="row" style="border-top: 1px solid var(--line); padding-top: 8px"><b>Tổng</b><b style="font-size: 18px">${money(o.total)}</b></div>
        ${o.status !== 'huy' && html`
          <div class="row" style="background: ${o.paid ? 'var(--green-soft)' : 'var(--rose-soft)'}; border-radius: 10px; padding: 8px 10px">
            <span class="strong ${o.paid ? 'pos' : 'neg'}" style="font-size: 14px">${o.paid ? `Đã thanh toán · ${PAYMENT[o.payment_method]}` : 'Chưa thanh toán'}</span>
            <button class="btn btn-sm no-print" id="toggle-paid">${o.paid ? 'Bỏ đánh dấu' : 'Đánh dấu đã trả'}</button>
          </div>`}
      </section>

      <section class="card stack">
        <div class="row"><div class="label-up" style="margin: 0">Lời thiệp & ghi chú</div><button class="link-btn no-print" id="edit-note">Sửa</button></div>
        ${o.card_message ? html`<div style="font-size: 15px; font-style: italic; white-space: pre-line">“${o.card_message}”</div>` : html`<div class="muted">Không có lời thiệp</div>`}
        ${o.note && html`<div class="muted">Ghi chú: ${o.note}</div>`}
      </section>

      <section class="card stack no-print">
        <div class="label-up" style="margin: 0">Ảnh bó hoa trước khi giao</div>
        ${o.photo_url ? html`
          <img class="photo" src="${o.photo_url}" alt="Ảnh bó hoa đơn #${o.id}">
          <div class="btns">
            <label class="btn" style="position: relative">Chụp lại<input type="file" accept="image/*" capture="environment" id="photo" style="position: absolute; inset: 0; opacity: 0"></label>
            <button class="btn btn-outline" id="share-photo">${raw(ICON.share)}Gửi khách</button>
          </div>` : html`
          <label class="photo-drop">${raw(ICON.camera)}<span id="photo-label">Chụp ảnh bó hoa để gửi khách</span><input type="file" accept="image/*" capture="environment" id="photo"></label>`}
      </section>
      ${ended && html`<a class="btn btn-outline btn-block no-print" href="#/don/moi?from=${o.id}">Đặt lại đơn này</a>`}
    </div>
    ${!ended && html`
      <div class="footer-bar"><div>
        <button class="btn btn-danger btn-lg" id="cancel">Hủy đơn</button>
        <button class="btn btn-primary btn-lg grow" id="next">${o.status === 'moi' && o.pickup ? 'Bắt đầu cắm' : STATUS[o.status].nextLabel} →</button>
      </div></div>`}`.s;

  const $ = (s) => el.querySelector(s);
  const act = (fn, msg) => async () => {
    try { await fn(); if (msg) toast(msg); await refresh({ keepScroll: true }); } catch (e) { toast(errMsg(e), 'error'); }
  };
  $('#print').onclick = () => window.print();

  if ($('#next')) {
    $('#next').onclick = async () => {
      // Khách lấy tại shop: cắm xong là giao, bỏ qua bước "Đang giao".
      const to = o.pickup && o.status === 'dang_cam' ? 'da_giao' : next;
      if (to === 'da_giao' && !o.paid && !confirm(`Đơn chưa thanh toán ${money(o.total)}. Vẫn đánh dấu đã giao?`)) return;
      await act(() => db.setOrderStatus(o.id, to), `Đơn #${o.id}: ${STATUS[to].label}`)();
    };
    if (o.pickup && o.status === 'dang_cam') $('#next').textContent = 'Khách đã nhận →';
    $('#cancel').onclick = async () => {
      if (!confirm(`Hủy đơn #${o.id}?${o.stock_deducted ? ' Hoa đã trừ sẽ được hoàn lại kho.' : ''}`)) return;
      await act(() => db.setOrderStatus(o.id, 'huy'), 'Đã hủy đơn')();
    };
  }

  $('#toggle-paid')?.addEventListener('click', () => {
    if (o.paid) { act(() => db.updateOrder(o.id, { paid: false }), 'Đã bỏ đánh dấu')(); return; }
    sheet({
      title: `Thu ${money(o.total)}`, submit: 'Xác nhận đã trả',
      body: html`<div class="opts" style="grid-template-columns: 1fr 1fr">
        ${Object.entries(PAYMENT).map(([k, v], i) => html`<label class="opt"><input type="radio" name="method" value="${k}" ${i === 0 ? 'checked' : ''} style="accent-color: var(--rose)">&nbsp;${v}</label>`)}
      </div>`,
      onSubmit: async (fd) => {
        await db.updateOrder(o.id, { paid: true, payment_method: fd.get('method') });
        toast('Đã ghi nhận thanh toán');
        refresh({ keepScroll: true });
      },
    });
  });

  $('#shipper')?.addEventListener('change', act(() => db.updateOrder(o.id, { shipper: $('#shipper').value.trim() }), 'Đã lưu shipper'));

  $('#share-ship')?.addEventListener('click', async () => {
    const text = [
      `Đơn #${o.id} · ${dateShort(o.delivery_date)} ${o.delivery_slot}`,
      `Người nhận: ${o.recipient_name} ${phoneFmt(o.recipient_phone)}`,
      o.address && `Địa chỉ: ${o.address}`,
      o.address && mapUrl,
      o.paid ? 'Đã thanh toán' : `Thu hộ: ${money(o.total)}`,
      o.note && `Ghi chú: ${o.note}`,
    ].filter(Boolean).join('\n');
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('Đã sao chép, dán vào Zalo cho shipper'); }
    } catch { /* người dùng đóng bảng chia sẻ */ }
  });

  $('#edit-note').onclick = () => sheet({
    title: 'Lời thiệp & ghi chú',
    body: html`<label class="field">Lời nhắn trên thiệp<textarea name="card" rows="3">${o.card_message}</textarea></label>
      <label class="field">Ghi chú<textarea name="note" rows="2">${o.note}</textarea></label>`,
    onSubmit: async (fd) => {
      await db.updateOrder(o.id, { card_message: fd.get('card'), note: fd.get('note') });
      refresh({ keepScroll: true });
    },
  });

  $('#edit-delivery')?.addEventListener('click', () => sheet({
    title: 'Sửa thời gian giao',
    body: html`<label class="field">Ngày giao<input type="date" name="date" value="${o.delivery_date}"></label>
      <label class="field">Khung giờ<input name="slot" list="slots" value="${o.delivery_slot}" placeholder="VD: 08–10h hoặc 14:30"></label>
      <datalist id="slots">${SLOTS.map((s) => html`<option value="${s}"></option>`)}</datalist>
      ${!o.pickup && html`<label class="field">Địa chỉ giao<input name="address" value="${o.address}"></label>`}`,
    onSubmit: async (fd) => {
      const patch = { delivery_date: fd.get('date') || o.delivery_date, delivery_slot: fd.get('slot').trim() };
      if (!o.pickup) patch.address = fd.get('address').trim();
      await db.updateOrder(o.id, patch);
      toast('Đã cập nhật');
      refresh({ keepScroll: true });
    },
  }));

  $('#photo')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const label = $('#photo-label');
    if (label) label.textContent = 'Đang tải ảnh lên…';
    try {
      const blob = await shrinkImage(file, db.mode === 'demo' ? 720 : 1280);
      const url = await db.uploadPhoto(blob, `orders/${o.id}`);
      await db.updateOrder(o.id, { photo_url: url });
      toast('Đã lưu ảnh');
      refresh({ keepScroll: true });
    } catch (err) {
      toast(errMsg(err), 'error');
      if (label) label.textContent = 'Chụp ảnh bó hoa để gửi khách';
    }
  });

  $('#share-photo')?.addEventListener('click', async () => {
    try {
      const blob = await (await fetch(o.photo_url)).blob();
      const file = new File([blob], `don-${o.id}.jpg`, { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `Bó hoa đơn #${o.id} của ${settings?.shop_name || 'shop'}` });
      else window.open(o.photo_url, '_blank');
    } catch { /* người dùng đóng bảng chia sẻ */ }
  });
}
