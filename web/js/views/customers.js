// Khách hàng: danh sách, hồ sơ, lịch sử đơn.
import { app, refresh, setQuery } from '../app.js';
import { html, raw, ICON, money, moneyShort, today, ddmm, dateRelative, phoneDigits, phoneFmt, statusChip, initials, toast, sheet, itemsLabel } from '../util.js';
import { upcomingBirthdays } from '../stats.js';

const avatarCls = (id) => `c${Number(id) % 4}`;

export async function list({ el, query }) {
  const customers = await app.db.listCustomers();
  const t = today();
  const f = query.f || '';
  const month = t.slice(5, 7);
  const filters = {
    '': () => true,
    bday: (c) => c.birthday?.slice(5, 7) === month,
    loyal: (c) => c.order_count >= 3,
    debt: (c) => c.debt > 0,
  };
  const soon = new Map(upcomingBirthdays(customers, t, 7).map((c) => [c.id, c]));
  const shown = customers.filter(filters[f] || filters['']);
  const pill = (key, label) => html`<button class="pill ${f === key ? 'on' : ''}" data-f="${key}">${label}</button>`;
  const loyal = customers.filter(filters.loyal).length;

  el.innerHTML = html`
    <header class="top" style="flex-direction: column; align-items: stretch; gap: 12px">
      <div class="row">
        <div><h1>Khách hàng</h1><div class="muted">${customers.length} khách · ${loyal} khách quen</div></div>
        <button class="btn btn-outline" id="add">+ Thêm</button>
      </div>
      <label class="search">${raw(ICON.search)}<input type="search" id="q" placeholder="Tìm tên hoặc số điện thoại…" aria-label="Tìm khách"></label>
      <div class="pills">${pill('', 'Tất cả')}${pill('bday', `Sinh nhật tháng ${Number(month)}`)}${pill('loyal', 'Khách quen')}${pill('debt', 'Còn nợ')}</div>
    </header>
    <div class="page">
      ${shown.length ? html`<div class="list">
        ${shown.map((c) => {
          const b = soon.get(c.id);
          return html`
            <div class="item" data-search="${`${c.name} ${c.phone}`.toLowerCase()}">
              <div class="avatar ${avatarCls(c.id)}">${initials(c.name)}</div>
              <a class="grow" href="#/khach/${c.id}" style="color: inherit">
                <div class="row" style="justify-content: flex-start; gap: 6px; flex-wrap: wrap">
                  <b style="font-size: 15px">${c.name}</b>
                  ${b ? html`<span class="chip c-amber">SN ${b.daysLeft === 0 ? 'hôm nay' : ddmm(b.nextDate)}</span>` : ''}
                  ${c.debt > 0 ? html`<span class="chip c-rose">Nợ ${moneyShort(c.debt)}</span>` : ''}
                </div>
                <div class="muted">${phoneFmt(c.phone)} · ${c.order_count} đơn · ${moneyShort(c.total_spent)}</div>
                ${c.note && html`<div class="muted" style="font-style: italic">${c.note}</div>`}
              </a>
              <a class="icon-btn" href="tel:${phoneDigits(c.phone)}" aria-label="Gọi ${c.name}" style="color: var(--rose)">${raw(ICON.phone)}</a>
            </div>`;
        })}
      </div>` : html`<div class="card empty">${f ? 'Không có khách nào.' : 'Chưa có khách. Khách được tự thêm khi tạo đơn.'}</div>`}
    </div>`.s;

  el.querySelector('#q').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const digits = phoneDigits(q);
    el.querySelectorAll('[data-search]').forEach((row) => {
      const s = row.dataset.search;
      row.classList.toggle('hidden', !!q && !s.includes(q) && !(digits.length >= 3 && s.includes(digits)));
    });
  });
  el.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => setQuery({ f: b.dataset.f }); });
  el.querySelector('#add').onclick = () => editSheet(null);
}

function editSheet(c) {
  const isNew = !c;
  c = c || { name: '', phone: '', address: '', birthday: '', note: '' };
  sheet({
    title: isNew ? 'Thêm khách' : 'Sửa thông tin khách',
    body: html`
      <label class="field">Tên<input name="name" value="${c.name}" autocomplete="off"></label>
      <label class="field">Số điện thoại<input name="phone" type="tel" inputmode="tel" value="${phoneFmt(c.phone)}" autocomplete="off"></label>
      <label class="field">Địa chỉ<input name="address" value="${c.address}"></label>
      <label class="field">Sinh nhật / ngày kỷ niệm<input type="date" name="birthday" value="${c.birthday || ''}"></label>
      <label class="field">Ghi chú (sở thích, người hay tặng…)<textarea name="note" rows="2">${c.note}</textarea></label>`,
    async onSubmit(fd) {
      const row = {
        name: fd.get('name').trim(), phone: phoneDigits(fd.get('phone')), address: fd.get('address').trim(),
        birthday: fd.get('birthday') || null, note: fd.get('note').trim(),
      };
      if (!row.name) throw new Error('Chưa nhập tên');
      if (row.phone.length < 9) throw new Error('Số điện thoại không hợp lệ');
      if (!isNew) row.id = c.id;
      const id = await app.db.saveCustomer(row);
      toast('Đã lưu');
      if (isNew) location.hash = `/khach/${id}`;
      else refresh({ keepScroll: true });
    },
  });
}

export async function detail({ el, params }) {
  const { db } = app;
  const id = Number(params[0]);
  const [c, orders] = await Promise.all([db.getCustomer(id), db.listOrders({ customerId: id, newestFirst: true, limit: 200 })]);
  const phone = phoneDigits(c.phone);
  el.innerHTML = html`
    <header class="top-nav"><a class="back" href="#/khach">${raw(ICON.back)}Khách hàng</a><h1></h1><button class="link-btn" id="edit" style="margin-right: 12px; font-size: 15px">Sửa</button></header>
    <div class="page">
      <div class="row" style="justify-content: flex-start; gap: 14px">
        <div class="avatar ${avatarCls(c.id)}" style="width: 60px; height: 60px; border-radius: 30px; font-size: 22px">${initials(c.name)}</div>
        <div class="grow"><h1 style="font-size: 24px">${c.name}</h1><div class="muted">${phoneFmt(c.phone)}${c.birthday ? ` · SN ${ddmm(c.birthday)}` : ''}</div></div>
      </div>
      ${c.note && html`<div class="card" style="font-style: italic">${c.note}</div>`}
      ${c.address && html`<div class="muted">${c.address}</div>`}
      <div class="btns">
        <a class="btn" href="tel:${phone}">${raw(ICON.phone)}Gọi</a>
        <a class="btn" href="https://zalo.me/${phone}" target="_blank" rel="noopener">Zalo</a>
        <a class="btn btn-primary" href="#/don/moi?phone=${phone}">+ Tạo đơn</a>
      </div>
      <div class="grid3" style="text-align: center">
        <div class="card"><div class="muted">Số đơn</div><b style="font-size: 18px">${c.order_count}</b></div>
        <div class="card"><div class="muted">Đã mua</div><b style="font-size: 18px">${moneyShort(c.total_spent)}</b></div>
        <div class="card"><div class="muted">Còn nợ</div><b style="font-size: 18px" class="${c.debt ? 'neg' : ''}">${moneyShort(c.debt)}</b></div>
      </div>
      <div class="sec"><h2>Lịch sử đơn</h2></div>
      ${orders.length ? html`<div class="list">
        ${orders.map((o) => html`
          <a class="item" href="#/don/${o.id}">
            <div class="grow"><div class="title">${itemsLabel(o)}</div><div class="muted">${dateRelative(o.delivery_date)} · ${money(o.total)}${o.recipient_name !== c.name ? ` · tặng ${o.recipient_name}` : ''}</div></div>
            ${statusChip(o.status)}
          </a>`)}
      </div>` : html`<div class="card empty">Chưa có đơn nào.</div>`}
    </div>`.s;
  el.querySelector('#edit').onclick = () => editSheet(c);
}
