// Chạy thử giao diện (bản dùng thử) trên trình duyệt kích thước iPhone: node tests/e2e.mjs [thư-mục-ảnh]
// Cần Playwright (npm i -g playwright hoặc NODE_PATH trỏ tới nơi cài).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = new URL('../web/', import.meta.url).pathname;
const SHOTS = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'vi-VN' });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
const toastSays = async (text) => page.locator('#toast.show', { hasText: text }).waitFor({ timeout: 5000 });
const step = async (name, fn) => { await fn(); console.log(`✓ ${name}`); };

try {
  await step('Tổng quan', async () => {
    await page.goto(base);
    await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    assert.equal(await page.locator('#side').isVisible(), false, 'điện thoại: không có menu trái');
    assert.ok(await page.locator('#tabs').isVisible(), 'điện thoại: có thanh menu dưới');
    assert.ok(await page.locator('header a[href="shop/"]', { hasText: 'Trang khách' }).isVisible(), 'nút mở trang khách trên Tổng quan');
    assert.equal(await page.locator('.list a.item[href^="#/don/"]').count(), 3);
    await page.getByText('Cảnh báo kho').waitFor();
    await shot('01-tong-quan');
  });

  await step('Tạo đơn khách cũ, ngày mai, chuyển khoản', async () => {
    await page.locator('.tab-add').click();
    await page.getByRole('heading', { name: 'Tạo đơn mới' }).waitFor();
    await page.locator('input[name=phone]').fill('0903123456');
    await page.getByText('Khách cũ:').waitFor();
    assert.equal(await page.locator('input[name=name]').inputValue(), 'Anh Tuấn');
    await page.locator('input[name=other]').check();
    await page.locator('input[name=rName]').fill('Chị Lan');
    await page.locator('input[name=rPhone]').fill('0938555777');
    await page.locator('input[name=address]').fill('45 Võ Văn Tần, Q.3');
    await page.locator('[data-date]').nth(1).click();
    await page.locator('[data-slot="10–12h"]').click();
    await page.getByRole('button', { name: '+ Thêm sản phẩm' }).click();
    await page.locator('dialog [data-pid]').first().click();
    await page.locator('[data-inc="0"]').click();
    await page.locator('textarea[name=card]').fill('Chúc em luôn vui!');
    await page.locator('[data-pay=chuyen_khoan]').click();
    await shot('02-tao-don');
    await page.locator('#save').click();
    await page.getByRole('heading', { name: /Đơn #\d+/ }).waitFor();
    await page.getByText('Đã thanh toán · Chuyển khoản').waitFor();
    await shot('03-chi-tiet-don');
  });

  await step('Chuyển trạng thái: bắt đầu cắm, đang giao', async () => {
    await page.locator('#next').click();
    await toastSays('Đang cắm');
    await page.locator('.progress .step.now', { hasText: 'Đang cắm' }).waitFor();
    await page.locator('#next').click();
    await toastSays('Đang giao');
  });

  await step('Bán tại quầy', async () => {
    await page.goto(`${base}#/don/moi`);
    await page.locator('input[name=phone]').fill('0977111222');
    await page.locator('input[name=name]').fill('Khách lẻ');
    await page.locator('[data-pickup="1"]').click();
    await page.locator('input[name=handover]').check();
    await page.getByRole('button', { name: '+ Thêm sản phẩm' }).click();
    await page.locator('#cname').fill('Bó tùy chọn tông trắng');
    await page.locator('#cprice').fill('300000');
    await page.locator('#cadd').click();
    await page.locator('[data-pay=tien_mat]').click();
    await page.locator('#save').click();
    await page.getByText('Đặt lại đơn này').waitFor();
  });

  await step('Danh sách đơn, lọc và tìm', async () => {
    await page.goto(`${base}#/don`);
    await page.getByRole('heading', { name: 'Đơn hàng' }).waitFor();
    await shot('04-don-hang');
    await page.locator('[data-d=upcoming]').click();
    await page.locator('#q').fill('Lan');
    await page.waitForTimeout(400);
    assert.ok(await page.locator('.order-card').count() >= 2);
  });

  await step('Kho: nhập hoa, hủy héo', async () => {
    await page.locator('#tabs a[href="#/kho"]').click();
    await page.getByRole('heading', { name: 'Kho hoa' }).waitFor();
    await shot('05-kho');
    await page.locator('[data-in]').first().click();
    await page.locator('dialog input[name=qty]').fill('30');
    await page.locator('dialog [type=submit]').click();
    await toastSays('Đã nhập kho');
    await page.locator('[data-out]:not([disabled])').first().click();
    await page.locator('dialog input[name=qty]').fill('2');
    await page.locator('dialog [type=submit]').click();
    await toastSays('Đã ghi nhận hủy');
    await page.locator('a[href="#/kho/lich-su"]').click();
    await page.locator('.chip', { hasText: 'Nhập' }).first().waitFor();
  });

  await step('Sản phẩm: sửa công thức', async () => {
    await page.goto(`${base}#/san-pham`);
    await page.locator('a.item').first().click();
    await page.locator('#comps select').first().waitFor();
    await shot('06-san-pham');
    await page.locator('#add-comp').click();
    await page.locator('#save').click();
    await toastSays('Đã lưu sản phẩm');
  });

  await step('Khách hàng', async () => {
    await page.goto(`${base}#/khach`);
    await page.getByRole('heading', { name: 'Khách hàng' }).waitFor();
    await shot('07-khach-hang');
    await page.locator('a[href^="#/khach/"]').first().click();
    await page.getByText('Lịch sử đơn').waitFor();
  });

  await step('Thu chi và báo cáo', async () => {
    await page.goto(`${base}#/thu-chi`);
    await page.locator('#add').click();
    await page.locator('dialog input[name=amount]').fill('150000');
    await page.locator('dialog [type=submit]').click();
    await toastSays('Đã thêm khoản chi');
    await page.goto(`${base}#/bao-cao`);
    await page.getByText('Doanh thu theo ngày').waitFor();
    await shot('08-bao-cao');
  });

  await step('Thêm và cài đặt', async () => {
    await page.goto(`${base}#/them`);
    await shot('09-them');
    await page.goto(`${base}#/cai-dat`);
    await page.locator('input[name=holidays]').fill('14/2, 8/3, 20/10');
    await page.getByRole('button', { name: 'Lưu cài đặt' }).click();
    await toastSays('Đã lưu cài đặt');
  });

  await step('Trang cho khách: xem mẫu, lọc, mở chi tiết', async () => {
    await page.goto(`${base}#/san-pham`);
    await page.locator('a.item', { hasText: 'Bó hồng đỏ' }).click();
    await page.locator('textarea[name=description]').fill('Bó hoa thử nghiệm cho trang khách');
    await page.locator('#save').click();
    await toastSays('Đã lưu sản phẩm');
    await page.goto(`${base}shop/`);
    await page.getByRole('heading', { name: 'Mẫu hoa' }).waitFor();
    const all = await page.locator('.p-card').count();
    assert.ok(all >= 3);
    assert.equal(await page.getByText(/giá vốn|tồn kho/i).count(), 0);
    await shot('10-trang-khach');
    await page.locator('[data-cat="Khai trương"]').click();
    assert.ok(await page.locator('.p-card').count() < all);
    await page.locator('[data-cat=""]').click();
    await page.locator('.p-card', { hasText: 'Bó hồng đỏ' }).click();
    await page.locator('dialog .detail-price').waitFor();
    await page.getByText('Bó hoa thử nghiệm cho trang khách').waitFor();
    assert.ok((await page.locator('#order-zalo').getAttribute('href')).startsWith('https://zalo.me/'));
    await shot('11-chi-tiet-mau');
    await page.locator('dialog [data-close]').click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot('12-trang-khach-may-tinh');
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await step('Laptop 1366px: menu trái, chia cột, hộp thoại giữa màn hình', async () => {
    await page.setViewportSize({ width: 1366, height: 820 });
    await page.goto(`${base}#/`);
    await page.locator('#side .side-link.on', { hasText: 'Tổng quan' }).waitFor();
    assert.equal(await page.locator('#tabs').isVisible(), false, 'laptop: ẩn thanh menu dưới');
    const tops = await page.locator('.stats > .card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, '4 ô số liệu nằm trên một hàng');
    const colLefts = await page.locator('.cols-main > .col').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    assert.equal(new Set(colLefts).size, 2, 'tổng quan chia 2 cột');
    await shot('20-laptop-tong-quan');

    await page.locator('#side a[href="#/don"]').click();
    await page.getByRole('heading', { name: 'Đơn hàng' }).waitFor();
    await page.locator('[data-d=upcoming]').click();
    await page.locator('#order-list > .order-card').first().waitFor();
    const cardLefts = await page.locator('#order-list > .order-card').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
    assert.ok(cardLefts >= 2, 'đơn hàng xếp nhiều cột');
    await shot('21-laptop-don-hang');
    await page.locator('#order-list > .order-card').first().click();
    await page.getByRole('heading', { name: /Đơn #\d+/ }).waitFor();
    await shot('22-laptop-chi-tiet-don');

    await page.locator('#side .side-create').click();
    await page.getByRole('heading', { name: 'Tạo đơn mới' }).waitFor();
    await shot('23-laptop-tao-don');
    await page.getByRole('button', { name: '+ Thêm sản phẩm' }).click();
    const box = await page.locator('dialog.sheet').boundingBox();
    assert.ok(box.x > 100 && box.y > 20, 'hộp thoại nằm giữa màn hình');
    await page.locator('dialog [data-close]').click();

    await page.locator('#side a[href="#/kho"]').click();
    await page.getByRole('heading', { name: 'Kho hoa' }).waitFor();
    await shot('24-laptop-kho');
    await page.locator('#side a[href="#/bao-cao"]').click();
    await page.getByText('Doanh thu theo ngày').waitFor();
    await shot('25-laptop-bao-cao');

    await page.goto(`${base}shop/`);
    await page.locator('.p-card').first().waitFor();
    assert.equal(await page.locator('.dock').isVisible(), false, 'laptop: không cần thanh nút ở đáy');
    assert.ok(await page.locator('.head-cta').isVisible(), 'laptop: nút Zalo/Gọi trên thanh đầu trang');
    await shot('26-laptop-trang-khach');
    await page.locator('.p-card').first().click();
    await page.locator('dialog.sheet.wide .detail-price').waitFor();
    await shot('27-laptop-chi-tiet-mau');
    await page.setViewportSize({ width: 390, height: 844 });
  });

  assert.deepEqual(errors, [], `Lỗi trên trang:\n${errors.join('\n')}`);
  console.log('E2E: tất cả các bước đều đạt');
} catch (e) {
  await shot('zz-loi');
  console.error(errors);
  throw e;
} finally {
  await browser.close();
  server.close();
}
