// Kiểm thử logic thuần: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoBackend } from '../web/js/backend-demo.js';
import { reservedByMaterial, materialStatus, nextHoliday, upcomingBirthdays, monthReport, dashboard, priceOf, productCost } from '../web/js/stats.js';
import { addDays, today, phoneFmt, moneyShort, money, parseMoney, html, raw, toCsv } from '../web/js/util.js';
import { slotStart } from '../web/js/util.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

test('html escape chống chèn mã', () => {
  assert.equal(html`<b>${'<img onerror=x>'}</b>`.s, '<b>&lt;img onerror=x&gt;</b>');
  assert.equal(html`${raw('<i>')}${['a', '&']}${null}${false}`.s, '<i>a&amp;');
});

test('định dạng tiền, SĐT, khung giờ', () => {
  assert.equal(money(680000), '680.000đ');
  assert.equal(moneyShort(38600000), '38,6 tr');
  assert.equal(moneyShort(640000), '640k');
  assert.equal(parseMoney('1.250.000đ'), 1250000);
  assert.equal(phoneFmt('0903123456'), '0903 123 456');
  assert.equal(slotStart('08–10h'), '08:00');
  assert.equal(slotStart('14:30'), '14:30');
  assert.equal(slotStart(''), '—');
  assert.equal(toCsv([['a,b', 'c"d']]), '﻿"a,b","c""d"');
});

test('ngày lễ và giá lễ', () => {
  assert.deepEqual(nextHoliday(['10-20'], '2026-10-17'), { date: '2026-10-20', daysLeft: 3 });
  assert.equal(nextHoliday(['10-20'], '2026-10-21'), null);
  assert.equal(nextHoliday(['01-01'], '2026-12-28')?.date, '2027-01-01');
  const p = { price: 650000, holiday_price: 750000 };
  assert.equal(priceOf(p, '2026-10-20', ['10-20']), 750000);
  assert.equal(priceOf(p, '2026-10-19', ['10-20']), 650000);
  assert.equal(priceOf({ price: 1, holiday_price: null }, '2026-10-20', ['10-20']), 1);
});

test('sinh nhật sắp tới, kể cả qua năm mới', () => {
  const list = upcomingBirthdays([
    { id: 1, birthday: '1990-01-02' }, { id: 2, birthday: '1985-12-30' }, { id: 3, birthday: '1990-06-01' }, { id: 4, birthday: null },
  ], '2026-12-29', 7);
  assert.deepEqual(list.map((c) => [c.id, c.daysLeft]), [[2, 1], [1, 4]]);
});

test('kho: lượng đơn đặt trước cần và cảnh báo', () => {
  const products = [{ id: 1, components: [{ material_id: 10, qty: 20 }, { material_id: 11, qty: 1 }] }];
  const orders = [
    { status: 'moi', stock_deducted: false, items: [{ product_id: 1, qty: 2 }, { product_id: null, qty: 1 }] },
    { status: 'dang_cam', stock_deducted: true, items: [{ product_id: 1, qty: 5 }] },
  ];
  const need = reservedByMaterial(orders, products);
  assert.equal(need.get(10), 40);
  assert.equal(need.get(11), 2);
  const [rose, paper] = materialStatus([
    { id: 10, kind: 'hoa', stock: 30, min_stock: 10, shelf_life_days: 5, last_import: '2026-10-13' },
    { id: 11, kind: 'phu_lieu', stock: 50, min_stock: 10, shelf_life_days: 365, last_import: null },
  ], need, '2026-10-17');
  assert.equal(rose.short, true);
  assert.equal(rose.expiring, true);
  assert.equal(rose.expireDate, '2026-10-18');
  assert.equal(paper.needImport, false);
});

test('báo cáo tháng', () => {
  const r = monthReport({
    month: '2026-10',
    orders: [
      { delivery_date: '2026-10-01', status: 'da_giao', total: 300, items: [{ name: 'A', qty: 1, price: 300 }] },
      { delivery_date: '2026-10-01', status: 'huy', total: 999, items: [{ name: 'A', qty: 1, price: 999 }] },
      { delivery_date: '2026-10-20', status: 'moi', total: 700, items: [{ name: 'B', qty: 2, price: 350 }] },
    ],
    prevOrders: [{ status: 'da_giao', total: 500 }],
    expenses: [{ category: 'Nhập hoa', amount: 400 }, { category: 'Ship', amount: 100 }],
    waste: [{ qty: -5, unit_cost: 10 }],
  });
  assert.equal(r.revenue, 1000);
  assert.equal(r.orderCount, 2);
  assert.equal(r.change, 1);
  assert.equal(r.profit, 500);
  assert.equal(r.wasteValue, 50);
  assert.equal(r.days.length, 31);
  assert.equal(r.days[0].revenue, 300);
  assert.deepEqual(r.topProducts.map((p) => p.name), ['B', 'A']);
});

test('bản dùng thử: luồng đơn hàng giống schema.sql', async () => {
  const db = createDemoBackend(memoryStorage());
  const t = today();
  const mats = await db.listMaterials();
  const rose = mats.find((m) => m.name === 'Hồng đỏ Đà Lạt');
  const product = (await db.listProducts()).find((p) => p.name === 'Bó hồng đỏ 20 bông');

  await db.importStock(rose.id, 50, 16000, 'chợ', t);
  const roseStock = async () => (await db.listMaterials()).find((m) => m.id === rose.id).stock;
  assert.equal(await roseStock(), 62);
  assert.ok((await db.listExpenses({ from: t, to: t })).some((e) => e.amount === 800000));

  const id = await db.createOrder({
    customer_name: 'Khách mới', customer_phone: '0911 222 333', delivery_date: addDays(t, 1), ship_fee: 30000, discount: 10000,
    items: [{ product_id: product.id, qty: 1 }, { name: 'Thiệp', price: 20000, qty: 1 }],
  });
  let o = await db.getOrder(id);
  assert.equal(o.total, product.price + 20000 + 20000);
  assert.equal(o.customer.phone, '0911222333');
  assert.equal(await roseStock(), 62, 'chưa trừ kho khi mới tạo');

  await db.setOrderStatus(id, 'dang_cam');
  assert.equal(await roseStock(), 42);
  await assert.rejects(db.setOrderStatus(id, 'moi'), /quay lại/);
  await db.setOrderStatus(id, 'huy');
  assert.equal(await roseStock(), 62, 'hoàn kho khi hủy');
  await assert.rejects(db.setOrderStatus(id, 'dang_giao'), /kết thúc/);

  await assert.rejects(db.createOrder({ customer_name: 'A', customer_phone: '12', delivery_date: t, items: [{ name: 'x', price: 1 }] }), /Số điện thoại/);
  await assert.rejects(db.wasteStock(rose.id, 999), /lớn hơn tồn kho/);
  // Lỗi giữa chừng không làm hỏng dữ liệu.
  await assert.rejects(db.createOrder({ customer_name: 'B', customer_phone: '0999888777', delivery_date: t, items: [{ product_id: 999999 }] }), /Không tìm thấy/);
  assert.ok(!(await db.listCustomers()).some((c) => c.phone === '0999888777'));

  const sale = await db.createOrder({ customer_name: 'Lẻ', customer_phone: '0900000001', delivery_date: t, pickup: true, paid: true, status: 'da_giao', items: [{ product_id: product.id }] });
  assert.equal((await db.getOrder(sale)).status, 'da_giao');
  assert.equal(await roseStock(), 42);

  await db.adjustStock(rose.id, 40);
  assert.equal(await roseStock(), 40);
  const moves = await db.listStockMoves({ materialId: rose.id });
  assert.deepEqual(moves.slice(0, 2).map((m) => [m.kind, m.qty]), [['kiem', -2], ['xuat', -20]]);
});

test('tổng quan dùng dữ liệu bản dùng thử', async () => {
  const db = createDemoBackend(memoryStorage());
  const t = today();
  const d = dashboard({
    orders: await db.listOrders({ from: `${t.slice(0, 7)}-01`, to: addDays(t, 7) }),
    unpaid: await db.listOrders({ unpaidOnly: true }),
    pending: await db.listOrders({ statuses: ['moi'] }),
    materials: await db.listMaterials(), products: await db.listProducts(), customers: await db.listCustomers(),
    settings: await db.getSettings(), todayIso: t,
  });
  assert.equal(d.ordersToday.length, 3);
  assert.ok(d.revenueToday > 0);
  assert.ok(d.stockAlerts.some((m) => m.name === 'Hồng đỏ Đà Lạt'));
  assert.ok(d.birthdays.some((c) => c.name === 'Anh Minh'));
});

test('trang cho khách: chỉ mẫu đang bán, không lộ giá vốn / công thức', async () => {
  const db = createDemoBackend(memoryStorage());
  const first = (await db.listProducts())[0];
  await db.saveProduct({ ...first, active: false });
  const { shop, products } = await db.publicCatalog();
  assert.ok(shop.shop_name);
  assert.ok(!products.some((p) => p.id === first.id));
  assert.ok(products.length > 0);
  for (const p of products) {
    assert.deepEqual(Object.keys(p).sort(), ['categories', 'description', 'group_id', 'holiday_price', 'id', 'name', 'photo_url', 'price']);
  }
});

test('bản dùng thử: nhóm sản phẩm như thư mục', async () => {
  const db = createDemoBackend(memoryStorage());
  const gid = await db.saveGroup({ name: ' Hoa hồng Plume ', photo_url: 'data:image/jpeg;base64,x' });
  await assert.rejects(db.saveGroup({ name: 'hoa hồng plume' }), /Đã có nhóm tên này/);
  await assert.rejects(db.saveGroup({ name: '  ' }), /Chưa nhập tên nhóm/);
  const loose = (await db.listProducts()).filter((p) => p.group_id == null);
  await db.moveProducts(loose.map((p) => p.id), gid);
  const inGroup = async () => (await db.listProducts()).filter((p) => p.group_id === gid).length;
  assert.equal(await inGroup(), loose.length);
  assert.equal((await db.listGroups()).find((g) => g.id === gid).name, 'Hoa hồng Plume');
  await db.deleteGroup(gid);
  assert.equal(await inGroup(), 0);
  assert.equal((await db.listProducts()).length, 4, 'xóa nhóm không xóa sản phẩm');

  // Dữ liệu dùng thử lưu từ trước khi có nhóm vẫn mở được.
  const storage = memoryStorage();
  createDemoBackend(storage);
  const old = JSON.parse(storage.getItem('shophoa-demo-v1'));
  delete old.product_groups;
  storage.setItem('shophoa-demo-v1', JSON.stringify(old));
  assert.deepEqual(await createDemoBackend(storage).listGroups(), []);
});

test('giá vốn: theo công thức nếu có, không thì lấy giá tự nhập', () => {
  const materials = [{ id: 1, cost: 15000 }, { id: 2, cost: 5000 }];
  assert.equal(productCost({ components: [{ material_id: 1, qty: 20 }, { material_id: 2, qty: 2 }], cost: 99 }, materials), 310000);
  assert.equal(productCost({ components: [], cost: 180000 }, materials), 180000);
  assert.equal(productCost({ components: [], cost: null }, materials), 0);
});
