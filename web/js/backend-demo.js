// Bản dùng thử: dữ liệu mẫu lưu trong trình duyệt (localStorage), cùng quy tắc nghiệp vụ với supabase/schema.sql.
import { addDays, today, phoneDigits, isoOf } from './util.js';
import { customerStats, isHoliday } from './stats.js';

const KEY = 'shophoa-demo-v1';
const FLOW = ['moi', 'dang_cam', 'dang_giao', 'da_giao'];
const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (msg) => { throw new Error(msg); };

function seed() {
  const t = today();
  const s = {
    seq: 100,
    settings: { id: 1, shop_name: 'Tiệm hoa (dùng thử)', phone: '0900000000', zalo: '', address: '12 Đường Hoa, Q.3, TP.HCM',
      intro: 'Hoa tươi mỗi ngày từ Đà Lạt. Nhận bó hoa, giỏ hoa, kệ khai trương, giao nhanh nội thành.',
      open_hours: '7:00 – 21:00 hằng ngày', default_ship_fee: 30000,
      holidays: ['02-14', '03-08', '10-20', '11-20', '12-24'] },
    materials: [], products: [], customers: [], orders: [], stock_moves: [], expenses: [],
  };
  const mat = (name, unit, stock, cost, min, life, kind = 'hoa', lastImport = addDays(t, -1)) => {
    const m = { id: ++s.seq, name, kind, unit, stock, cost, min_stock: min, shelf_life_days: life,
      last_import: kind === 'hoa' ? lastImport : null, active: true };
    s.materials.push(m);
    return m.id;
  };
  const rose = mat('Hồng đỏ Đà Lạt', 'cành', 12, 15000, 30, 5);
  const baby = mat('Baby trắng', 'bó', 3, 45000, 5, 6);
  const daisy = mat('Cúc tana', 'cành', 40, 4000, 20, 4, 'hoa', addDays(t, -3));
  const carn = mat('Cẩm chướng hồng', 'cành', 55, 6000, 20, 7);
  const sun = mat('Hướng dương', 'cành', 20, 18000, 10, 5);
  const paper = mat('Giấy gói kraft', 'tờ', 120, 5000, 30, 365, 'phu_lieu');
  const ribbon = mat('Ruy băng lụa', 'cuộn', 35, 12000, 10, 365, 'phu_lieu');
  const basket = mat('Giỏ mây', 'cái', 6, 40000, 3, 365, 'phu_lieu');

  const prod = (name, cats, price, holiday, comps, description = '') => {
    const p = { id: ++s.seq, name, description, categories: cats, price, holiday_price: holiday, photo_url: null, active: true,
      components: comps.map(([material_id, qty]) => ({ material_id, qty })) };
    s.products.push(p);
    return p;
  };
  const p1 = prod('Bó hồng đỏ 20 bông', ['Sinh nhật', 'Tình yêu'], 650000, 750000, [[rose, 20], [baby, 1], [paper, 2], [ribbon, 1]],
    '20 hồng đỏ Đà Lạt, điểm baby trắng, gói giấy kraft và ruy băng lụa.');
  const p2 = prod('Giỏ hướng dương', ['Khai trương', 'Chúc mừng'], 520000, null, [[sun, 7], [daisy, 10], [basket, 1], [ribbon, 1]],
    'Giỏ mây 7 bông hướng dương rực rỡ cùng cúc tana, hợp chúc mừng, khai trương.');
  const p3 = prod('Bó cẩm chướng hồng', ['Sinh nhật', 'Tặng mẹ'], 350000, 420000, [[carn, 15], [baby, 1], [paper, 2]],
    '15 cẩm chướng hồng dịu dàng, món quà ý nghĩa tặng mẹ, tặng cô.');
  prod('Bó cúc tana mini', ['Sinh nhật'], 180000, null, [[daisy, 15], [paper, 1], [ribbon, 1]],
    'Bó nhỏ xinh 15 cành cúc tana, vừa túi tiền.');

  const bday = (offset) => `1990-${addDays(t, offset).slice(5)}`;
  const cus = (name, phone, address, birthday = null, note = '') => {
    const c = { id: ++s.seq, name, phone, address, birthday, note, created_at: new Date().toISOString() };
    s.customers.push(c);
    return c.id;
  };
  const tuan = cus('Anh Tuấn', '0903123456', '', null, 'Hay đặt hoa cho vợ (chị Lan)');
  const minh = cus('Anh Minh', '0907555221', '12 Lê Lợi, Q.1', bday(2), 'Thích hoa trắng');
  const cty = cus('Cty Minh Phát', '0283998899', '12 Nguyễn Lương Bằng, Q.7');
  const huy = cus('Anh Huy', '0988000117', 'Bình Thạnh');

  const order = (customer_id, date, slot, items, extra = {}) => {
    const subtotal = items.reduce((a, [p, q]) => a + p.price * q, 0);
    const o = { id: ++s.seq, customer_id, recipient_name: '', recipient_phone: '', address: '', pickup: false,
      anonymous: false, delivery_date: date, delivery_slot: slot, card_message: '', note: '', subtotal,
      ship_fee: 30000, discount: 0, total: subtotal + 30000, status: 'moi', stock_deducted: false, paid: false,
      payment_method: 'tien_mat', shipper: '', photo_url: null, created_at: new Date().toISOString(), ...extra,
      items: items.map(([p, qty]) => ({ id: ++s.seq, product_id: p.id, name: p.name, price: p.price, qty })) };
    o.total = Math.max(o.subtotal + o.ship_fee - o.discount, 0);
    const c = s.customers.find((x) => x.id === customer_id);
    o.recipient_name ||= c.name;
    o.recipient_phone ||= c.phone;
    s.orders.push(o);
    return o;
  };
  order(tuan, t, '08–10h', [[p1, 1]], { recipient_name: 'Chị Lan', recipient_phone: '0938555777',
    address: '45 Võ Văn Tần, Q.3', card_message: 'Chúc em luôn xinh đẹp và hạnh phúc!', status: 'dang_cam', stock_deducted: true });
  order(cty, t, '10–12h', [[p2, 2]], { address: '12 Nguyễn Lương Bằng, Q.7', paid: true, payment_method: 'chuyen_khoan' });
  order(huy, t, '14–16h', [[p3, 1]], { address: 'Bình Thạnh', status: 'dang_giao', stock_deducted: true, shipper: 'Tâm' });
  order(minh, addDays(t, -1), '16–18h', [[p3, 1]], { status: 'da_giao', stock_deducted: true, paid: true });
  order(minh, addDays(t, -6), '08–10h', [[p1, 1]], { status: 'da_giao', stock_deducted: true, paid: true });
  order(tuan, addDays(t, 2), '08–10h', [[p1, 2]], { recipient_name: 'Chị Lan', address: '45 Võ Văn Tần, Q.3' });
  s.expenses.push({ id: ++s.seq, date: addDays(t, -1), category: 'Nhập hoa', amount: 1200000, note: 'Chợ hoa Hồ Thị Kỷ' });
  s.expenses.push({ id: ++s.seq, date: `${t.slice(0, 7)}-01`, category: 'Mặt bằng', amount: 4000000, note: '' });
  return s;
}

export function createDemoBackend(storage = globalThis.localStorage) {
  let s;
  try { s = JSON.parse(storage.getItem(KEY)); } catch { s = null; }
  if (!s) s = seed();
  const save = () => { try { storage.setItem(KEY, JSON.stringify(s)); } catch { fail('Bộ nhớ máy đã đầy (ảnh quá nhiều?)'); } };
  save();

  const id = () => ++s.seq;
  const material = (mid) => s.materials.find((m) => m.id === mid) || fail('Không tìm thấy hoa trong kho');
  const orderRow = (oid) => s.orders.find((o) => o.id === oid) || fail(`Không tìm thấy đơn #${oid}`);
  const move = (material_id, kind, qty, unit_cost = 0, order_id = null, note = '') =>
    s.stock_moves.push({ id: id(), material_id, kind, qty, unit_cost, order_id, note, created_at: new Date().toISOString() });
  const withCustomer = (o) => {
    const c = s.customers.find((x) => x.id === o.customer_id);
    return clone({ ...o, customer: c && { id: c.id, name: c.name, phone: c.phone } });
  };

  function deduct(o) {
    if (o.stock_deducted || o.status === 'huy') return;
    const need = new Map();
    for (const it of o.items) {
      const p = s.products.find((x) => x.id === it.product_id);
      for (const c of p?.components || []) need.set(c.material_id, (need.get(c.material_id) || 0) + c.qty * it.qty);
    }
    for (const [mid, qty] of need) {
      const m = material(mid);
      m.stock -= qty;
      move(mid, 'xuat', -qty, m.cost, o.id, `Đơn #${o.id}`);
    }
    o.stock_deducted = true;
  }
  function restore(o) {
    if (!o.stock_deducted) return;
    const used = new Map();
    for (const mv of s.stock_moves.filter((x) => x.order_id === o.id)) used.set(mv.material_id, (used.get(mv.material_id) || 0) + mv.qty);
    for (const [mid, qty] of used) {
      if (qty >= 0) continue;
      material(mid).stock -= qty;
      move(mid, 'hoan', -qty, 0, o.id, `Hủy đơn #${o.id}`);
    }
    o.stock_deducted = false;
  }
  function setStatus(o, status) {
    if (['da_giao', 'huy'].includes(o.status)) fail(`Đơn #${o.id} đã kết thúc, không đổi trạng thái được`);
    if (status === 'huy') restore(o);
    else if (!FLOW.includes(status)) fail(`Trạng thái không hợp lệ: ${status}`);
    else if (FLOW.indexOf(status) <= FLOW.indexOf(o.status)) fail('Không thể quay lại trạng thái trước');
    else deduct(o);
    o.status = status;
  }
  const tx = (fn) => async (...args) => {
    const backup = JSON.stringify(s);
    try { const r = fn(...args); save(); return r; } catch (e) { s = JSON.parse(backup); throw e; }
  };

  return {
    mode: 'demo',
    async getUser() { return { id: 'demo', email: 'demo', name: 'Chủ shop (dùng thử)', role: 'owner' }; },
    async signIn() {},
    async signOut() {},
    reset() { s = seed(); save(); },

    async getSettings() { return clone(s.settings); },
    saveSettings: tx((patch) => { Object.assign(s.settings, patch); }),

    async listMaterials() { return clone([...s.materials].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'vi'))); },
    saveMaterial: tx((m) => {
      if (!m.name?.trim()) fail('Chưa nhập tên');
      if (s.materials.some((x) => x.name === m.name && x.id !== m.id)) fail('Tên này đã có trong kho');
      if (m.id) Object.assign(material(m.id), m);
      else s.materials.push({ stock: 0, last_import: null, active: true, ...m, id: id() });
    }),
    importStock: tx((mid, qty, unitCost, note = '', date = today()) => {
      if (!(qty > 0)) fail('Số lượng nhập phải lớn hơn 0');
      if (!(unitCost >= 0)) fail('Giá nhập không hợp lệ');
      const m = material(mid);
      m.stock += qty; m.cost = unitCost; m.last_import = date;
      move(mid, 'nhap', qty, unitCost, null, note);
      if (qty * unitCost > 0) s.expenses.push({ id: id(), date, category: 'Nhập hoa', amount: qty * unitCost, note: `${m.name} × ${qty} ${m.unit} ${note}`.trim() });
    }),
    wasteStock: tx((mid, qty, note = '') => {
      if (!(qty > 0)) fail('Số lượng hủy phải lớn hơn 0');
      const m = material(mid);
      if (qty > m.stock) fail(`Số lượng hủy lớn hơn tồn kho (${m.stock} ${m.unit})`);
      m.stock -= qty;
      move(mid, 'huy', -qty, m.cost, null, note);
    }),
    adjustStock: tx((mid, actual, note = '') => {
      if (!(actual >= 0)) fail('Số lượng thực tế không hợp lệ');
      const m = material(mid);
      if (actual !== m.stock) { move(mid, 'kiem', actual - m.stock, m.cost, null, note || 'Kiểm kho'); m.stock = actual; }
    }),
    async listStockMoves({ materialId, kind, from, to, limit = 200 } = {}) {
      return clone(s.stock_moves
        .filter((m) => (!materialId || m.material_id === materialId) && (!kind || m.kind === kind)
          && (!from || isoOf(new Date(m.created_at)) >= from) && (!to || isoOf(new Date(m.created_at)) <= to))
        .sort((a, b) => b.id - a.id).slice(0, limit)
        .map((m) => { const mat = s.materials.find((x) => x.id === m.material_id); return { ...m, material: mat && { name: mat.name, unit: mat.unit } }; }));
    },

    async publicCatalog() {
      const { shop_name, phone, zalo, address, intro, open_hours, holidays } = s.settings;
      return clone({
        shop: { shop_name, phone, zalo: zalo || '', address, intro: intro || '', open_hours: open_hours || '', holidays },
        products: s.products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
          .map(({ id: pid, name, description, categories, price, holiday_price, photo_url }) =>
            ({ id: pid, name, description: description || '', categories, price, holiday_price, photo_url })),
      });
    },

    async listProducts() { return clone([...s.products].sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'vi'))); },
    saveProduct: tx((p) => {
      if (!p.name?.trim()) fail('Chưa nhập tên sản phẩm');
      const merged = new Map();
      for (const c of p.components || []) merged.set(c.material_id, (merged.get(c.material_id) || 0) + c.qty);
      const row = { ...p, name: p.name.trim(), components: [...merged].map(([material_id, qty]) => ({ material_id, qty })) };
      if (p.id) { Object.assign(s.products.find((x) => x.id === p.id) || fail('Không tìm thấy sản phẩm'), row); return p.id; }
      row.id = id();
      s.products.push(row);
      return row.id;
    }),

    async listCustomers() { return clone(customerStats(s.customers, s.orders).sort((a, b) => b.total_spent - a.total_spent)); },
    async getCustomer(cid) { return clone(customerStats(s.customers, s.orders).find((c) => c.id === cid) || fail('Không tìm thấy khách')); },
    saveCustomer: tx((c) => {
      const phone = phoneDigits(c.phone);
      if (s.customers.some((x) => x.phone === phone && x.id !== c.id)) fail('Số điện thoại này đã có khách khác');
      const fields = { name: c.name, phone, address: c.address || '', birthday: c.birthday || null, note: c.note || '' };
      if (c.id) { Object.assign(s.customers.find((x) => x.id === c.id), fields); return c.id; }
      const row = { ...fields, id: id(), created_at: new Date().toISOString() };
      s.customers.push(row);
      return row.id;
    }),

    async listOrders({ from, to, statuses, unpaidOnly, customerId, limit = 500, newestFirst } = {}) {
      const key = (o) => `${o.delivery_date} ${o.delivery_slot} ${String(o.id).padStart(8, '0')}`;
      const rows = s.orders.filter((o) => (!from || o.delivery_date >= from) && (!to || o.delivery_date <= to)
        && (!statuses?.length || statuses.includes(o.status)) && (!unpaidOnly || (!o.paid && o.status !== 'huy'))
        && (!customerId || o.customer_id === customerId))
        .sort((a, b) => key(a).localeCompare(key(b)) * (newestFirst ? -1 : 1));
      return rows.slice(0, limit).map(withCustomer);
    },
    async getOrder(oid) { return withCustomer(orderRow(oid)); },
    createOrder: tx((p) => {
      const phone = phoneDigits(p.customer_phone);
      const name = (p.customer_name || '').trim();
      if (phone.length < 9) fail('Số điện thoại không hợp lệ');
      if (!name) fail('Chưa nhập tên khách');
      if (!p.delivery_date) fail('Chưa chọn ngày giao');
      if (!p.items?.length) fail('Đơn hàng chưa có sản phẩm');
      let c = s.customers.find((x) => x.phone === phone);
      if (c) c.name = name;
      else { c = { id: id(), name, phone, address: p.pickup ? '' : p.address || '', birthday: null, note: '', created_at: new Date().toISOString() }; s.customers.push(c); }
      const holiday = isHoliday(s.settings.holidays, p.delivery_date);
      const items = p.items.map((it) => {
        const qty = it.qty ?? 1;
        if (!(qty >= 1)) fail('Số lượng không hợp lệ');
        if (it.product_id != null) {
          const pr = s.products.find((x) => x.id === it.product_id) || fail('Không tìm thấy sản phẩm');
          if (!pr.active) fail(`Sản phẩm "${pr.name}" đã ngừng bán`);
          const price = holiday && pr.holiday_price != null ? pr.holiday_price : pr.price;
          return { id: id(), product_id: pr.id, name: pr.name, price, qty };
        }
        if (!(it.price >= 0) || !it.name?.trim()) fail('Sản phẩm tùy chọn cần có tên và giá');
        return { id: id(), product_id: null, name: it.name.trim(), price: it.price, qty };
      });
      const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0);
      const ship = Math.max(p.ship_fee || 0, 0);
      const discount = Math.max(p.discount || 0, 0);
      const o = { id: id(), customer_id: c.id, recipient_name: p.recipient_name?.trim() || name,
        recipient_phone: phoneDigits(p.recipient_phone) || phone, address: p.address || '', pickup: !!p.pickup,
        anonymous: !!p.anonymous, delivery_date: p.delivery_date, delivery_slot: p.delivery_slot || '',
        card_message: p.card_message || '', note: p.note || '', subtotal, ship_fee: ship, discount,
        total: Math.max(subtotal + ship - discount, 0), status: 'moi', stock_deducted: false, paid: !!p.paid,
        payment_method: p.payment_method || 'tien_mat', shipper: '', photo_url: null,
        created_at: new Date().toISOString(), items };
      s.orders.push(o);
      if (p.status && p.status !== 'moi') setStatus(o, p.status);
      return o.id;
    }),
    setOrderStatus: tx((oid, status) => setStatus(orderRow(oid), status)),
    updateOrder: tx((oid, patch) => {
      const allowed = ['paid', 'payment_method', 'shipper', 'photo_url', 'note', 'card_message', 'delivery_slot', 'delivery_date', 'address'];
      const o = orderRow(oid);
      for (const k of allowed) if (k in patch) o[k] = patch[k];
    }),

    async listExpenses({ from, to }) {
      return clone(s.expenses.filter((e) => e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
    },
    addExpense: tx((e) => {
      if (!(e.amount > 0)) fail('Số tiền phải lớn hơn 0');
      if (!e.category) fail('Chưa chọn loại chi');
      s.expenses.push({ ...e, id: id() });
    }),
    deleteExpense: tx((eid) => { s.expenses = s.expenses.filter((e) => e.id !== eid); }),

    async uploadPhoto(blob) {
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    },
    async exportAll() {
      const { seq, ...rest } = clone(s);
      return rest;
    },
  };
}
