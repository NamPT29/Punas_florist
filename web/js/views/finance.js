// Thu chi và Báo cáo tháng.
import { app, refresh, setQuery } from '../app.js';
import { html, raw, ICON, money, moneyShort, num, today, ddmm, monthOf, addMonths, monthRange, monthLabel, parseMoney, toast, sheet, download, toCsv, PAYMENT, STATUS, itemsLabel } from '../util.js';
import { monthReport } from '../stats.js';

const CATEGORIES = ['Nhập hoa', 'Phụ liệu', 'Mặt bằng', 'Điện nước', 'Lương', 'Ship', 'Quảng cáo', 'Khác'];

function monthNav(month) {
  const cur = monthOf(today());
  return html`
    <div class="row" style="gap: 6px">
      <button class="icon-btn" data-m="${addMonths(month, -1)}" aria-label="Tháng trước">‹</button>
      <b style="font-size: 14px; min-width: 92px; text-align: center">${monthLabel(month)}</b>
      <button class="icon-btn" data-m="${addMonths(month, 1)}" aria-label="Tháng sau" ${month >= cur ? 'disabled' : ''}>›</button>
    </div>`;
}
const bindMonthNav = (el) => el.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => setQuery({ m: b.dataset.m }); });

// ===================== Thu chi =====================
export async function expenses({ el, query }) {
  const month = query.m || monthOf(today());
  const { from, to } = monthRange(month);
  const rows = await app.db.listExpenses({ from, to });
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const cats = new Map();
  for (const e of rows) cats.set(e.category, (cats.get(e.category) || 0) + Number(e.amount));
  const catList = [...cats].sort((a, b) => b[1] - a[1]);

  el.innerHTML = html`
    <header class="top"><div class="row" style="gap: 4px"><a class="back" href="#/them" aria-label="Quay lại">${raw(ICON.back)}</a><h1>Thu chi</h1></div>${monthNav(month)}</header>
    <div class="page">
      <div class="card stack">
        <div class="row"><span class="muted">Tổng chi ${monthLabel(month).toLowerCase()}</span><b style="font-size: 20px">${money(total)}</b></div>
        ${catList.map(([c, v]) => html`<div><div class="row" style="font-size: 14px"><span>${c}</span><b>${moneyShort(v)}</b></div><div class="track"><span style="width: ${(v / total) * 100}%"></span></div></div>`)}
        <a class="link-btn" href="#/bao-cao?m=${month}">Xem doanh thu & lãi ›</a>
      </div>
      <button class="btn btn-primary" id="add">+ Thêm khoản chi</button>
      ${rows.length ? html`<div class="list">
        ${rows.map((e) => html`
          <div class="item">
            <div class="grow"><div class="title">${e.category} · ${money(e.amount)}</div><div class="muted">${ddmm(e.date)}${e.note ? ` · ${e.note}` : ''}</div></div>
            <button class="icon-btn plain" data-del="${e.id}" aria-label="Xóa khoản chi">${raw(ICON.trash)}</button>
          </div>`)}
      </div>` : html`<div class="card empty">Tháng này chưa có khoản chi. Phiếu nhập hoa được tự ghi vào đây.</div>`}
    </div>`.s;
  bindMonthNav(el);
  el.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Xóa khoản chi này?')) return;
      await app.db.deleteExpense(Number(b.dataset.del));
      toast('Đã xóa');
      refresh({ keepScroll: true });
    };
  });
  el.querySelector('#add').onclick = () => sheet({
    title: 'Thêm khoản chi',
    body: html`
      <div class="opts">${CATEGORIES.map((c, i) => html`<label class="opt"><input type="radio" name="category" value="${c}" ${i === 2 ? 'checked' : ''} style="accent-color: var(--rose)">&nbsp;${c}</label>`)}</div>
      <label class="field">Số tiền<input name="amount" data-money inputmode="numeric" placeholder="0"></label>
      <label class="field">Ngày<input type="date" name="date" value="${month === monthOf(today()) ? today() : `${month}-01`}"></label>
      <label class="field">Ghi chú<input name="note"></label>`,
    async onSubmit(fd) {
      const amount = parseMoney(fd.get('amount'));
      if (!amount) throw new Error('Chưa nhập số tiền');
      await app.db.addExpense({ date: fd.get('date') || today(), category: fd.get('category'), amount, note: fd.get('note').trim() });
      toast('Đã thêm khoản chi');
      refresh({ keepScroll: true });
    },
  });
}

// ===================== Báo cáo =====================
export async function report({ el, query }) {
  const { db } = app;
  const month = query.m || monthOf(today());
  const { from, to } = monthRange(month);
  const prev = monthRange(addMonths(month, -1));
  const [orders, prevOrders, expenseRows, waste] = await Promise.all([
    db.listOrders({ from, to, limit: 5000 }),
    db.listOrders({ from: prev.from, to: prev.to, limit: 5000 }),
    db.listExpenses({ from, to }),
    db.listStockMoves({ kind: 'huy', from, to, limit: 5000 }),
  ]);
  const r = monthReport({ month, orders, prevOrders, expenses: expenseRows, waste });
  const maxDay = Math.max(...r.days.map((d) => d.revenue), 1);
  const best = r.days.reduce((a, d) => (d.revenue > a.revenue ? d : a), r.days[0]);

  el.innerHTML = html`
    <header class="top"><div class="row" style="gap: 4px"><a class="back" href="#/them" aria-label="Quay lại">${raw(ICON.back)}</a><h1>Báo cáo</h1></div>${monthNav(month)}</header>
    <div class="page">
      <div class="grid2">
        <div class="card stat"><div class="label">Doanh thu</div><div class="value">${moneyShort(r.revenue)}</div>
          ${r.change != null ? html`<div class="small strong ${r.change >= 0 ? 'pos' : 'neg'}">${r.change >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(r.change * 100))}% so với tháng trước</div>` : html`<div class="small muted">${r.orderCount} đơn</div>`}</div>
        <div class="card stat"><div class="label">Chi phí</div><div class="value">${moneyShort(r.expense)}</div><div class="small muted">${r.expenseByCategory[0] ? `${r.expenseByCategory[0].category} ${Math.round((r.expenseByCategory[0].amount / r.expense) * 100)}%` : 'chưa ghi'}</div></div>
        <div class="card stat green"><div class="label">Lãi</div><div class="value ${r.profit >= 0 ? 'pos' : 'neg'}">${moneyShort(r.profit)}</div></div>
        <div class="card stat"><div class="label">Hoa hư hỏng</div><div class="value neg">${moneyShort(r.wasteValue)}</div><div class="small muted">${r.revenue ? `${((r.wasteValue / r.revenue) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% doanh thu` : ''}</div></div>
      </div>

      <section class="card stack">
        <div class="row"><h2 style="margin: 0">Doanh thu theo ngày</h2><span class="muted">${r.orderCount} đơn · TB ${moneyShort(r.avgOrder)}/đơn</span></div>
        <div class="bars" role="img" aria-label="Doanh thu theo ngày trong ${monthLabel(month)}${best.revenue ? `, cao nhất ngày ${ddmm(best.date)}: ${money(best.revenue)}` : ''}">
          ${r.days.map((d) => html`<span class="${d.revenue === 0 ? 'zero' : d === best ? 'top' : ''}" style="height: ${(d.revenue / maxDay) * 100}%" title="${ddmm(d.date)}: ${money(d.revenue)}"></span>`)}
        </div>
        <div class="row muted small"><span>${ddmm(from)}</span><span>${best.revenue ? `Cao nhất ${ddmm(best.date)} · ${moneyShort(best.revenue)}` : 'Chưa có doanh thu'}</span><span>${ddmm(to)}</span></div>
      </section>

      <section class="card stack">
        <h2 style="margin: 0">Bán chạy</h2>
        ${r.topProducts.length ? r.topProducts.map((p, i) => html`<div class="row" style="font-size: 14px"><span><b>${i + 1}.</b> ${p.name}</span><span class="muted nowrap">${num(p.qty)} · ${moneyShort(p.revenue)}</span></div>`) : html`<div class="muted">Chưa có đơn.</div>`}
      </section>

      <section class="card stack">
        <div class="row"><h2 style="margin: 0">Chi phí theo loại</h2><a class="link-btn" href="#/thu-chi?m=${month}">Chi tiết ›</a></div>
        ${r.expenseByCategory.length ? r.expenseByCategory.map((e) => html`<div><div class="row" style="font-size: 14px"><span>${e.category}</span><b>${moneyShort(e.amount)}</b></div><div class="track"><span style="width: ${(e.amount / r.expense) * 100}%"></span></div></div>`) : html`<div class="muted">Chưa có khoản chi.</div>`}
      </section>

      <button class="btn btn-outline btn-lg" id="csv">${raw(ICON.download)}Xuất Excel đơn hàng tháng</button>
    </div>`.s;
  bindMonthNav(el);
  el.querySelector('#csv').onclick = () => {
    const rows = [['Mã đơn', 'Ngày giao', 'Giờ', 'Khách', 'SĐT khách', 'Người nhận', 'Địa chỉ', 'Sản phẩm', 'Tạm tính', 'Ship', 'Giảm', 'Tổng', 'Trạng thái', 'Thanh toán']];
    for (const o of orders) {
      rows.push([o.id, o.delivery_date, o.delivery_slot, o.customer?.name, o.customer?.phone, o.recipient_name, o.pickup ? 'Lấy tại shop' : o.address,
        itemsLabel(o), o.subtotal, o.ship_fee, o.discount, o.total, STATUS[o.status]?.label, o.paid ? PAYMENT[o.payment_method] : 'Chưa trả']);
    }
    download(`don-hang-${month}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  };
}
