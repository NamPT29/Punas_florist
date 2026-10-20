// Kiểm thử tích hợp web/js/backend-supabase.js với PostgREST thật. Chạy qua tests/supabase-it/run.sh.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseBackend } from '../../web/js/backend-supabase.js';
import { dashboard, monthReport } from '../../web/js/stats.js';
import { addDays } from '../../web/js/util.js';

const PGRST = process.argv[2];
const SECRET = process.env.JWT_SECRET;
const OWNER = '00000000-0000-0000-0000-000000000001';
const STRANGER = '00000000-0000-0000-0000-000000000002';
const STAFF = '00000000-0000-0000-0000-000000000003';

// Supabase gọi REST ở /rest/v1/…: dựng một proxy nhỏ trước PostgREST.
const proxy = http.createServer((req, res) => {
  if (!req.url.startsWith('/rest/v1/')) { res.writeHead(404).end(); return; }
  const target = new URL(req.url.slice('/rest/v1'.length), PGRST);
  const up = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502).end(e.message); });
  req.pipe(up);
}).listen(0, '127.0.0.1');
await new Promise((r) => proxy.once('listening', r));
const URL_ = `http://127.0.0.1:${proxy.address().port}`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload) => {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload })}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
};
const ANON_KEY = jwt({ role: 'anon' });
const backendAs = (sub) => createSupabaseBackend(URL_, ANON_KEY, {
  createClient,
  clientOptions: {
    auth: { persistSession: false, autoRefreshToken: false },
    global: sub ? { headers: { Authorization: `Bearer ${jwt({ role: 'authenticated', sub })}` } } : {},
  },
});

// Ngày theo giờ Việt Nam, giống trên điện thoại của shop.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const step = async (name, fn) => { await fn(); console.log(`✓ ${name}`); };

const owner = await backendAs(OWNER);
const staff = await backendAs(STAFF);
const stranger = await backendAs(STRANGER);
const anon = await backendAs(null);
let rose, product, orderId, customerId;

try {
  await step('Phân quyền: khách vãng lai và người lạ không đọc/ghi được dữ liệu', async () => {
    await assert.rejects(anon.listOrders({}), /permission denied/);
    assert.deepEqual(await stranger.listMaterials(), []);
    await assert.rejects(stranger.saveMaterial({ name: 'x', kind: 'hoa', unit: 'cành', cost: 0, min_stock: 0, shelf_life_days: 5 }), /row-level security/);
  });

  await step('Cài đặt: chủ shop sửa được, nhân viên không', async () => {
    const s = await owner.getSettings();
    assert.ok(Array.isArray(s.holidays));
    await owner.saveSettings({ shop_name: 'Tiệm Hoa Thử', phone: '0901234567', address: 'Q.1, TP.HCM', slogan: 'Hoa tươi mỗi ngày', default_ship_fee: 30000,
      holidays: [addDays(today, 180).slice(5)] });  // ngày lễ xa hôm nay để giá đơn trong bài thử luôn là giá thường
    assert.equal((await owner.getSettings()).shop_name, 'Tiệm Hoa Thử');
    await assert.rejects(staff.saveSettings({ shop_name: 'Bị đổi' }), /Chỉ chủ shop/);
  });

  await step('Kho: thêm hoa, trùng tên, nhập hoa tự ghi chi phí', async () => {
    await owner.saveMaterial({ name: 'Hồng đỏ', kind: 'hoa', unit: 'cành', cost: 15000, min_stock: 30, shelf_life_days: 5 });
    await owner.saveMaterial({ name: 'Giấy kraft', kind: 'phu_lieu', unit: 'tờ', cost: 5000, min_stock: 10, shelf_life_days: 365 });
    await assert.rejects(owner.saveMaterial({ name: 'Hồng đỏ', kind: 'hoa', unit: 'cành', cost: 1, min_stock: 0, shelf_life_days: 5 }), /đã có trong kho/);
    rose = (await owner.listMaterials()).find((m) => m.name === 'Hồng đỏ');
    await owner.importStock(rose.id, 50, 16000, 'Chợ hoa', today);
    const m = (await owner.listMaterials()).find((x) => x.id === rose.id);
    assert.equal(m.stock, 50);
    assert.equal(typeof m.stock, 'number');
    assert.ok((await owner.listExpenses({ from: today, to: today })).some((e) => e.amount === 800000));
  });

  await step('Sản phẩm: lưu kèm công thức, đọc lại có công thức', async () => {
    const paper = (await owner.listMaterials()).find((m) => m.name === 'Giấy kraft');
    const id = await owner.saveProduct({
      id: null, name: 'Bó hồng đỏ', description: 'Hồng Đà Lạt', categories: ['Sinh nhật'], price: 650000, holiday_price: 750000,
      photo_url: null, active: true, components: [{ material_id: rose.id, qty: 20 }, { material_id: paper.id, qty: 2 }],
    });
    product = (await owner.listProducts()).find((p) => p.id === id);
    assert.deepEqual(product.components.map((c) => c.qty).sort(), [2, 20]);
    const manual = await owner.saveProduct({ id: null, name: 'Bó tự nhập vốn', price: 300000, cost: 180000, active: false, components: [] });
    assert.equal((await owner.listProducts()).find((p) => p.id === manual).cost, 180000);
  });

  await step('Nhóm sản phẩm: tạo, trùng tên, chuyển sản phẩm vào, xóa nhóm vẫn giữ sản phẩm', async () => {
    const gid = await owner.saveGroup({ name: 'Hoa hồng', photo_url: null });
    await assert.rejects(staff.saveGroup({ name: 'HOA hồng' }), /Đã có nhóm tên này/);
    await staff.moveProducts([product.id], gid);
    const groupOf = async () => (await owner.listProducts()).find((p) => p.id === product.id).group_id;
    assert.equal(await groupOf(), gid);
    await owner.saveGroup({ id: gid, name: 'Hoa hồng Đà Lạt', photo_url: 'https://example.com/hong.jpg' });
    assert.deepEqual((await staff.listGroups()).map((g) => [g.name, g.photo_url]), [['Hoa hồng Đà Lạt', 'https://example.com/hong.jpg']]);
    const temp = await owner.saveGroup({ name: 'Xóa thử' });
    await owner.saveProduct({ ...product, group_id: temp });
    assert.equal(await groupOf(), temp);
    await owner.deleteGroup(temp);
    assert.equal(await groupOf(), null);
    await owner.moveProducts([product.id], gid);
    assert.deepEqual(await stranger.listGroups(), []);
    await assert.rejects(anon.listGroups(), /permission denied/);
  });

  await step('Đơn hàng: tạo, đọc kèm khách và sản phẩm, lọc', async () => {
    orderId = await staff.createOrder({
      customer_name: 'Anh Tuấn', customer_phone: '0903 123 456', recipient_name: 'Chị Lan', recipient_phone: '0938555777',
      address: '45 Võ Văn Tần', delivery_date: addDays(today, 1), delivery_slot: '08–10h', ship_fee: 30000, discount: 10000,
      items: [{ product_id: product.id, qty: 1 }, { name: 'Thiệp', price: 20000, qty: 1 }],
    });
    const o = await owner.getOrder(orderId);
    customerId = o.customer.id;
    assert.equal(o.customer.phone, '0903123456');
    assert.equal(o.items.length, 2);
    assert.equal(o.total, 650000 + 20000 + 30000 - 10000);
    for (const filter of [{ from: addDays(today, 1), to: addDays(today, 1) }, { statuses: ['moi'] }, { unpaidOnly: true },
      { customerId }, { newestFirst: true, limit: 5 }, { limit: 5000 }]) {
      assert.ok((await owner.listOrders(filter)).some((x) => x.id === orderId), JSON.stringify(filter));
    }
  });

  await step('Trạng thái: cắm thì trừ kho, không quay lại được, trả tiền', async () => {
    await owner.setOrderStatus(orderId, 'dang_cam');
    assert.equal((await owner.listMaterials()).find((m) => m.id === rose.id).stock, 30);
    await assert.rejects(owner.setOrderStatus(orderId, 'moi'), /quay lại/);
    await owner.updateOrder(orderId, { paid: true, payment_method: 'chuyen_khoan', shipper: 'Tâm', status: 'da_giao' });
    const o = await owner.getOrder(orderId);
    assert.equal(o.paid, true);
    assert.equal(o.shipper, 'Tâm');
    assert.equal(o.status, 'dang_cam', 'updateOrder không được đổi trạng thái');
  });

  await step('Kho: hủy héo, kiểm kho, lịch sử theo ngày Việt Nam', async () => {
    await owner.wasteStock(rose.id, 2, 'Héo');
    await owner.adjustStock(rose.id, 25, '');
    assert.equal((await owner.listMaterials()).find((m) => m.id === rose.id).stock, 25);
    const moves = await owner.listStockMoves({ materialId: rose.id });
    assert.deepEqual(moves.map((m) => m.kind), ['kiem', 'huy', 'xuat', 'nhap']);
    assert.equal(moves[0].material.name, 'Hồng đỏ');
    assert.equal((await owner.listStockMoves({ kind: 'huy', from: today, to: today })).length, 1);
  });

  await step('Khách hàng: thống kê, thêm, trùng số điện thoại', async () => {
    const c = (await owner.listCustomers()).find((x) => x.id === customerId);
    assert.equal(c.order_count, 1);
    assert.equal(c.total_spent, 690000);
    assert.equal(c.debt, 0);
    const id = await owner.saveCustomer({ name: 'Chị Linh', phone: '0912000303', address: '', birthday: '1990-10-19', note: 'Thích hoa trắng' });
    assert.equal((await owner.getCustomer(id)).name, 'Chị Linh');
    await assert.rejects(owner.saveCustomer({ name: 'Trùng', phone: '0912000303', address: '', birthday: null, note: '' }), /đã có khách khác/);
  });

  await step('Thu chi: thêm, xem theo tháng, xóa', async () => {
    await owner.addExpense({ date: today, category: 'Mặt bằng', amount: 4000000, note: '' });
    const e = (await owner.listExpenses({ from: today, to: today })).find((x) => x.category === 'Mặt bằng');
    await owner.deleteExpense(e.id);
    assert.ok(!(await owner.listExpenses({ from: today, to: today })).some((x) => x.id === e.id));
  });

  await step('Hủy đơn hoàn kho; đơn bán tại quầy', async () => {
    await owner.setOrderStatus(orderId, 'huy');
    assert.equal((await owner.listMaterials()).find((m) => m.id === rose.id).stock, 45);
    const sale = await staff.createOrder({ customer_name: 'Khách lẻ', customer_phone: '0977111222', delivery_date: today, pickup: true,
      paid: true, payment_method: 'tien_mat', status: 'da_giao', items: [{ product_id: product.id, qty: 1 }] });
    assert.equal((await owner.getOrder(sale)).status, 'da_giao');
  });

  await step('Trang cho khách: không cần đăng nhập, không lộ dữ liệu nội bộ', async () => {
    const done = (await owner.listOrders({ statuses: ['da_giao'] }))[0];
    await staff.updateOrder(done.id, { photo_url: 'https://example.com/giao.jpg', public_photo: true });
    const { shop, products, groups, delivered } = await anon.publicCatalog();
    assert.deepEqual(delivered, [{ photo_url: 'https://example.com/giao.jpg', items: 'Bó hồng đỏ', month: `${today.slice(5, 7)}/${today.slice(0, 4)}` }]);
    assert.equal(shop.shop_name, 'Tiệm Hoa Thử');
    assert.equal(shop.slogan, 'Hoa tươi mỗi ngày');
    assert.deepEqual(Object.keys(products[0]).sort(), ['categories', 'description', 'group_id', 'holiday_price', 'id', 'name', 'photo_url', 'price']);
    assert.deepEqual(groups.map((g) => g.name), ['Hoa hồng Đà Lạt']);
    assert.equal(products.find((p) => p.id === product.id).group_id, groups[0].id);
  });

  await step('Tổng quan, báo cáo, sao lưu chạy trên dữ liệu thật', async () => {
    const [orders, unpaid, pending, materials, products, customers, settings] = await Promise.all([
      owner.listOrders({ from: `${today.slice(0, 7)}-01`, to: addDays(today, 7) }), owner.listOrders({ unpaidOnly: true }),
      owner.listOrders({ statuses: ['moi'] }), owner.listMaterials(), owner.listProducts(), owner.listCustomers(), owner.getSettings(),
    ]);
    const d = dashboard({ orders, unpaid, pending, materials, products, customers, settings, todayIso: today });
    assert.equal(d.revenueToday, 650000);
    const r = monthReport({ month: today.slice(0, 7), orders, prevOrders: [], expenses: await owner.listExpenses({ from: today, to: today }),
      waste: await owner.listStockMoves({ kind: 'huy' }) });
    assert.equal(r.wasteValue, 2 * 16000);
    const backup = await owner.exportAll();
    assert.equal(backup.staff.length, 2);
    assert.equal(backup.product_groups.length, 1);
    assert.ok(backup.orders.length >= 2);
  });
  console.log('Supabase (PostgREST): tất cả kiểm thử đều đạt');
} finally {
  proxy.close();
}
