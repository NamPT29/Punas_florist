// Tính toán thuần (không gọi mạng) cho Tổng quan, Kho, Báo cáo. Dùng chung cho bản thật và bản dùng thử.
import { addDays, daysBetween, monthRange, parseIso, isoOf, ddmm, fold } from './util.js';

const active = (o) => o.status !== 'huy';
const sum = (xs, f) => xs.reduce((s, x) => s + (Number(f(x)) || 0), 0);

/** Lượng hoa mà các đơn chưa cắm (trạng thái Mới) sẽ cần, theo công thức hiện tại. */
export function reservedByMaterial(orders, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const need = new Map();
  for (const o of orders) {
    if (o.status !== 'moi' || o.stock_deducted) continue;
    for (const it of o.items || []) {
      const p = byId.get(it.product_id);
      for (const c of p?.components || []) {
        need.set(c.material_id, (need.get(c.material_id) || 0) + c.qty * it.qty);
      }
    }
  }
  return need;
}

/** Thêm cờ cảnh báo cho từng loại hoa. */
export function materialStatus(materials, reserved, todayIso) {
  return materials.map((m) => {
    const res = reserved.get(m.id) || 0;
    const expireDate = m.last_import ? addDays(m.last_import, m.shelf_life_days) : null;
    const expiring = m.kind === 'hoa' && m.stock > 0 && expireDate && daysBetween(todayIso, expireDate) <= 1;
    const low = m.stock <= m.min_stock;
    const short = res > m.stock;
    return { ...m, reserved: res, expireDate, expiring, low, short, needImport: low || short };
  });
}

/** Ngày lễ gần nhất trong `withinDays` ngày tới (holidays dạng 'MM-DD'). */
export function nextHoliday(holidays, todayIso, withinDays = 7) {
  for (let i = 0; i <= withinDays; i++) {
    const d = addDays(todayIso, i);
    if ((holidays || []).includes(d.slice(5))) return { date: d, daysLeft: i };
  }
  return null;
}

// Ngày lễ quen thuộc: tên hiển thị và từ khóa (không dấu) để nhận ra mẫu dành cho dịp đó.
const HOLIDAY_INFO = {
  '02-14': ['Valentine 14/2', ['valentine']],
  '03-08': ['Quốc tế Phụ nữ 8/3', ['phu nu']],
  '10-20': ['Phụ nữ Việt Nam 20/10', ['phu nu']],
  '11-20': ['Nhà giáo Việt Nam 20/11', ['nha giao', 'thay co']],
  '12-24': ['Giáng sinh', ['giang sinh', 'noel']],
};
export const holidayName = (iso) => HOLIDAY_INFO[iso.slice(5)]?.[0] || `Dịp ${ddmm(iso)}`;

/**
 * Mẫu cho một dịp lễ: ô "Dịp" của mẫu ghi đúng ngày (20/10, 20-10, Ngày 20/10…) hoặc tên dịp (Phụ nữ, Nhà giáo…).
 * Chưa mẫu nào ghi thì lấy các mẫu có giá ngày lễ riêng.
 */
export function holidayProducts(products, iso) {
  const [, m, d] = iso.split('-').map(Number);
  const date = new RegExp(`(^|\\D)0?${d}\\s*[/.-]\\s*0?${m}(\\D|$)`);
  const words = HOLIDAY_INFO[iso.slice(5)]?.[1] || [];
  const tagged = products.filter((p) => (p.categories || []).some((c) => date.test(c) || words.some((w) => fold(c).includes(w))));
  return tagged.length ? tagged : products.filter((p) => p.holiday_price != null);
}

export const isHoliday = (holidays, iso) => !!iso && (holidays || []).includes(iso.slice(5));

export function priceOf(product, iso, holidays) {
  return isHoliday(holidays, iso) && product.holiday_price != null ? product.holiday_price : product.price;
}

/** Khách có sinh nhật trong `withinDays` ngày tới (kể cả qua năm mới). */
export function upcomingBirthdays(customers, todayIso, withinDays = 7) {
  const t = parseIso(todayIso);
  const out = [];
  for (const c of customers) {
    if (!c.birthday) continue;
    const [, mm, dd] = c.birthday.split('-').map(Number);
    let next = new Date(t.getFullYear(), mm - 1, dd);
    if (next < t) next = new Date(t.getFullYear() + 1, mm - 1, dd);
    const days = daysBetween(todayIso, isoOf(next));
    if (days <= withinDays) out.push({ ...c, daysLeft: days, nextDate: isoOf(next) });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

const slotKey = (o) => `${o.delivery_date} ${o.delivery_slot || '99'} ${String(o.id).padStart(8, '0')}`;
export const sortOrders = (orders) => [...orders].sort((a, b) => slotKey(a).localeCompare(slotKey(b)));

/**
 * Số liệu trang Tổng quan.
 * orders: đơn có ngày giao từ đầu tháng tới hôm nay+7; unpaid: mọi đơn chưa trả; pending: mọi đơn trạng thái Mới.
 */
export function dashboard({ orders, unpaid, pending, materials, products, customers, settings, todayIso }) {
  const month = todayIso.slice(0, 7);
  const todays = orders.filter((o) => active(o) && o.delivery_date === todayIso);
  const monthToDate = orders.filter((o) => active(o) && o.delivery_date.startsWith(month) && o.delivery_date <= todayIso);
  const reserved = reservedByMaterial(pending, products);
  const mats = materialStatus(materials.filter((m) => m.active !== false), reserved, todayIso);

  let holiday = nextHoliday(settings?.holidays, todayIso);
  if (holiday) {
    const hOrders = orders.filter((o) => active(o) && o.delivery_date === holiday.date);
    const need = reservedByMaterial(hOrders, products);
    const needs = [...need.entries()]
      .map(([id, qty]) => { const m = materials.find((x) => x.id === id); return m && { ...m, need: qty }; })
      .filter(Boolean)
      .sort((a, b) => b.need - a.need)
      .slice(0, 3);
    holiday = { ...holiday, orders: hOrders.length, needs };
  }

  return {
    revenueToday: sum(todays, (o) => o.total),
    ordersToday: sortOrders(todays),
    deliveredToday: todays.filter((o) => o.status === 'da_giao').length,
    revenueMonth: sum(monthToDate, (o) => o.total),
    unpaidTotal: sum(unpaid.filter(active), (o) => o.total),
    stockAlerts: mats.filter((m) => m.needImport || m.expiring),
    birthdays: upcomingBirthdays(customers, todayIso),
    holiday,
  };
}

/** Báo cáo tháng. orders: đơn trong tháng; prevOrders: tháng trước; waste: lịch sử kho loại 'huy' trong tháng. */
export function monthReport({ month, orders, prevOrders, expenses, waste }) {
  const valid = orders.filter(active);
  const revenue = sum(valid, (o) => o.total);
  const prevRevenue = sum(prevOrders.filter(active), (o) => o.total);
  const { from, to } = monthRange(month);
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = valid.filter((o) => o.delivery_date === d);
    days.push({ date: d, revenue: sum(list, (o) => o.total), orders: list.length });
  }
  const prod = new Map();
  for (const o of valid) {
    for (const it of o.items || []) {
      const p = prod.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
      p.qty += it.qty;
      p.revenue += it.qty * it.price;
      prod.set(it.name, p);
    }
  }
  const cats = new Map();
  for (const e of expenses) cats.set(e.category, (cats.get(e.category) || 0) + Number(e.amount));
  const expense = sum(expenses, (e) => e.amount);
  return {
    month,
    revenue,
    orderCount: valid.length,
    avgOrder: valid.length ? revenue / valid.length : 0,
    prevRevenue,
    change: prevRevenue ? (revenue - prevRevenue) / prevRevenue : null,
    expense,
    profit: revenue - expense,
    wasteValue: sum(waste, (m) => -m.qty * m.unit_cost),
    days,
    topProducts: [...prod.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    expenseByCategory: [...cats.entries()].map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/** Thống kê khách (bản dùng thử; bản thật lấy từ view customer_stats). */
export function customerStats(customers, orders) {
  return customers.map((c) => {
    const mine = orders.filter((o) => o.customer_id === c.id && active(o));
    return {
      ...c,
      order_count: mine.length,
      total_spent: sum(mine, (o) => o.total),
      debt: sum(mine.filter((o) => !o.paid), (o) => o.total),
      last_order_date: mine.map((o) => o.delivery_date).sort().pop() || null,
    };
  });
}

/** Giá vốn: có công thức thì tính từ giá hoa trong kho, chưa có thì lấy giá vốn chủ shop tự nhập. */
export const productCost = (product, materials) => (product.components?.length
  ? sum(product.components, (c) => (materials.find((x) => x.id === c.material_id)?.cost || 0) * c.qty)
  : Number(product.cost) || 0);
