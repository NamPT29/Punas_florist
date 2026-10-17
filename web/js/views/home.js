// Màn Tổng quan.
import { app } from '../app.js';
import { html, raw, ICON, money, moneyShort, today, addDays, dateLong, ddmm, num, phoneDigits, statusChip, initials, slotStart, itemsLabel, placeLabel } from '../util.js';
import { dashboard } from '../stats.js';

export async function render({ el }) {
  const { db, settings } = app;
  const t = today();
  const [orders, unpaid, pending, materials, products, customers] = await Promise.all([
    db.listOrders({ from: `${t.slice(0, 7)}-01`, to: addDays(t, 7) }),
    db.listOrders({ unpaidOnly: true, limit: 1000 }),
    db.listOrders({ statuses: ['moi'], limit: 1000 }),
    db.listMaterials(),
    db.listProducts(),
    db.listCustomers(),
  ]);
  const d = dashboard({ orders, unpaid, pending, materials, products, customers, settings, todayIso: t });

  el.innerHTML = html`
    <header class="top">
      <div>
        <div class="eyebrow">${raw(ICON.logo)}<span>${settings?.shop_name || 'Shop Hoa'} · ${dateLong(t)}</span></div>
        <h1 style="margin-top: 2px">Tổng quan</h1>
      </div>
    </header>
    <div class="page">
      ${d.holiday && html`
        <div class="card rose banner">
          <div class="grow">
            <div class="title">${d.holiday.daysLeft === 0 ? `Hôm nay là ${ddmm(d.holiday.date)}` : `${ddmm(d.holiday.date)} còn ${d.holiday.daysLeft} ngày`}</div>
            <div class="desc">${d.holiday.orders ? `${d.holiday.orders} đơn đã đặt` : 'Chưa có đơn đặt trước'}${d.holiday.needs.length ? html` · cần ${d.holiday.needs.map((m) => `${num(m.need)} ${m.unit} ${m.name.toLowerCase()}`).join(', ')}` : ''}</div>
          </div>
          ${d.holiday.orders ? html`<a class="btn btn-primary btn-sm" href="#/don?d=${d.holiday.date}">Xem đơn</a>` : html`<a class="btn btn-primary btn-sm" href="#/don/moi">+ Tạo đơn</a>`}
        </div>`}

      <div class="grid2">
        <div class="card stat"><div class="label">Doanh thu hôm nay</div><div class="value">${money(d.revenueToday)}</div></div>
        <a class="card stat" href="#/don" style="color: inherit"><div class="label">Đơn hôm nay</div><div class="value">${d.ordersToday.length} <span class="small pos" style="font-weight: 500">· ${d.deliveredToday} đã giao</span></div></a>
        <a class="card stat" href="#/bao-cao" style="color: inherit"><div class="label">Doanh thu tháng ${Number(t.slice(5, 7))}</div><div class="value">${moneyShort(d.revenueMonth)}</div></a>
        <a class="card stat" href="#/don?d=no" style="color: inherit"><div class="label">Khách còn nợ</div><div class="value ${d.unpaidTotal ? 'neg' : ''}">${moneyShort(d.unpaidTotal)}</div></a>
      </div>

      <div class="sec"><h2>Cần giao hôm nay</h2><a href="#/don">Tất cả</a></div>
      ${d.ordersToday.length ? html`
        <div class="list">
          ${d.ordersToday.map((o) => html`
            <a class="item" href="#/don/${o.id}">
              <div class="time">${slotStart(o.delivery_slot)}</div>
              <div class="grow"><div class="title">${itemsLabel(o)}</div><div class="muted">${o.recipient_name} · ${placeLabel(o)}</div></div>
              ${statusChip(o.status)}
            </a>`)}
        </div>` : html`
        <div class="card empty">Hôm nay chưa có đơn cần giao.<br><a class="btn btn-outline" href="#/don/moi">+ Tạo đơn</a></div>`}

      ${d.stockAlerts.length > 0 && html`
        <div class="sec"><h2>Cảnh báo kho</h2><a href="#/kho">Mở kho</a></div>
        <div class="list">
          ${d.stockAlerts.slice(0, 5).map((m) => html`
            <a class="item" href="#/kho">
              ${m.needImport ? html`<span class="chip c-rose">Cần nhập</span>` : html`<span class="chip c-amber">Sắp héo</span>`}
              <div class="grow" style="font-size: 14px"><b>${m.name}</b> ·
                ${m.short ? `đơn đặt cần ${num(m.reserved)}, còn ${num(m.stock)} ${m.unit}`
                  : m.needImport ? `còn ${num(m.stock)}/${num(m.min_stock)} ${m.unit}`
                    : `nhập ${ddmm(m.last_import)}, héo khoảng ${ddmm(m.expireDate)}`}
              </div>
            </a>`)}
        </div>`}

      ${d.birthdays.length > 0 && html`
        <div class="sec"><h2>Sinh nhật 7 ngày tới</h2><a href="#/khach">Khách hàng</a></div>
        <div class="list">
          ${d.birthdays.map((c, i) => html`
            <div class="item">
              <div class="avatar c${i % 4}">${initials(c.name)}</div>
              <a class="grow" href="#/khach/${c.id}" style="color: inherit">
                <div class="title">${c.name} · ${c.daysLeft === 0 ? 'hôm nay' : ddmm(c.nextDate)}</div>
                <div class="muted">${c.order_count} đơn${c.note ? ` · ${c.note}` : ''}</div>
              </a>
              <a class="btn btn-sm" href="tel:${phoneDigits(c.phone)}">Gọi</a>
            </div>`)}
        </div>`}
    </div>`.s;
}
