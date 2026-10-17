// Chạy thử giao diện (bản dùng thử) trên trình duyệt kích thước iPhone: node tests/e2e.mjs [thư-mục-ảnh]
// Cần Playwright (npm i -g playwright hoặc NODE_PATH trỏ tới nơi cài).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { addDays, ddmm, today } from '../web/js/util.js';

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
const base = `http://localhost:${server.address().port}/`;  // trang khách (trang chính)
const admin = `${base}quan-ly/`;  // trang quản lý

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
// Tắt service worker: nếu không, file tải qua service worker sẽ bỏ qua việc thay config.js bên dưới.
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'vi-VN', serviceWorkers: 'block',
});
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
// Luôn chạy bản dùng thử (dữ liệu mẫu), kể cả khi config.js đã trỏ tới Supabase thật.
await ctx.route('**/js/config.js', (r) => r.fulfill({
  contentType: 'text/javascript',
  body: "export const SUPABASE_URL = ''; export const SUPABASE_ANON_KEY = '';",
}));
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
    await page.goto(admin);
    await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    assert.equal(await page.locator('#side').isVisible(), false, 'điện thoại: không có menu trái');
    assert.ok(await page.locator('#tabs').isVisible(), 'điện thoại: có thanh menu dưới');
    assert.ok(await page.locator('header a[href="../"]', { hasText: 'Trang khách' }).isVisible(), 'nút mở trang khách trên Tổng quan');
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
    // Gõ không dấu vẫn ra gợi ý; Enter chọn mẫu đầu tiên.
    await page.locator('#pq').fill('cam chuong');
    assert.equal(await page.locator('dialog [data-pid]:not(.hidden)').count(), 1);
    await page.locator('#pq').press('Enter');
    await page.locator('#items .row', { hasText: 'Bó cẩm chướng hồng' }).waitFor();
    await page.locator('dialog [data-pid]').first().waitFor({ state: 'detached', timeout: 3000 });  // hộp chọn đã đóng
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
    await page.goto(`${admin}#/don/moi`);
    await page.locator('input[name=phone]').fill('0977111222');
    await page.locator('input[name=name]').fill('Khách lẻ');
    await page.locator('[data-pickup="1"]').click();
    await page.locator('input[name=handover]').check();
    await page.getByRole('button', { name: '+ Thêm sản phẩm' }).click();
    // Màn hình thấp: danh sách cuộn được và có nút lướt xuống.
    await page.setViewportSize({ width: 390, height: 520 });
    await page.locator('#pmore:not(.hidden)').waitFor();
    await shot('03b-chon-san-pham');
    await page.locator('#pmore').click();
    await page.waitForFunction(() => document.querySelector('#plist').scrollTop > 0);
    await page.setViewportSize({ width: 390, height: 844 });
    // Tên bắt đầu bằng chữ đã gõ được xếp trước tên chỉ chứa chữ đó ở cuối.
    await page.locator('#pq').fill('hong');
    assert.deepEqual(await page.locator('dialog [data-pid]:not(.hidden) .title').allTextContents(), ['Bó hồng đỏ 20 bông', 'Bó cẩm chướng hồng']);
    // Không có mẫu trùng tên thì thêm làm sản phẩm tùy chọn.
    await page.locator('#pq').fill('Bó tùy chọn tông trắng');
    await page.locator('#pcustom').click();
    assert.equal(await page.locator('#cname').inputValue(), 'Bó tùy chọn tông trắng');
    await page.locator('#cprice').fill('300000');
    await page.locator('#cadd').click();
    await page.locator('[data-pay=tien_mat]').click();
    await page.locator('#save').click();
    await page.getByText('Đặt lại đơn này').waitFor();
  });

  await step('Danh sách đơn, lọc và tìm', async () => {
    await page.goto(`${admin}#/don`);
    await page.getByRole('heading', { name: 'Đơn hàng' }).waitFor();
    await shot('04-don-hang');
    // Chọn kỳ có sẵn.
    await page.locator('#pick-range').click();
    await page.locator('dialog [data-from]', { hasText: '7 ngày tới' }).click();
    await page.locator('#pick-range.on', { hasText: '–' }).waitFor();
    assert.ok(await page.locator('.order-card').count() >= 4, 'đơn hôm nay và các ngày tới');
    // Tự chọn kỳ (nhập ngược thứ tự vẫn hiểu đúng), kỳ đã qua thì đơn mới nhất lên đầu.
    const t = today();
    await page.locator('#pick-range').click();
    await page.locator('dialog input[name=from]').fill(addDays(t, -1));
    await page.locator('dialog input[name=to]').fill(addDays(t, -7));
    await page.getByRole('button', { name: 'Xem đơn' }).click();
    await page.locator('#pick-range.on', { hasText: `${ddmm(addDays(t, -7))} – ${ddmm(addDays(t, -1))}` }).waitFor();
    assert.equal(await page.locator('.order-card').count(), 2);
    assert.match(await page.locator('.order-card .strong').first().textContent(), /Hôm qua/);
    await shot('04b-don-theo-ky');
    // Từ Tổng quan bấm "Khách còn nợ".
    await page.goto(`${admin}#/don?d=no`);
    await page.locator('.pill.on', { hasText: 'Đơn còn nợ' }).waitFor();
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
    await page.goto(`${admin}#/san-pham`);
    await page.locator('a.item').first().click();
    await page.locator('#comps select').first().waitFor();
    await shot('06-san-pham');
    await page.locator('#add-comp').click();
    await page.locator('#save').click();
    await toastSays('Đã lưu sản phẩm');
  });

  await step('Khách hàng', async () => {
    await page.goto(`${admin}#/khach`);
    await page.getByRole('heading', { name: 'Khách hàng' }).waitFor();
    await shot('07-khach-hang');
    await page.locator('a[href^="#/khach/"]').first().click();
    await page.getByText('Lịch sử đơn').waitFor();
  });

  await step('Thu chi và báo cáo', async () => {
    await page.goto(`${admin}#/thu-chi`);
    await page.locator('#add').click();
    await page.locator('dialog input[name=amount]').fill('150000');
    await page.locator('dialog [type=submit]').click();
    await toastSays('Đã thêm khoản chi');
    await page.goto(`${admin}#/bao-cao`);
    await page.getByText('Doanh thu theo ngày').waitFor();
    await shot('08-bao-cao');
  });

  await step('Thêm và cài đặt', async () => {
    await page.goto(`${admin}#/them`);
    await shot('09-them');
    await page.goto(`${admin}#/cai-dat`);
    await page.locator('input[name=holidays]').fill('14/2, 8/3, 20/10');
    await page.locator('#cover').setInputFiles(new URL('./fixtures/cover-test.jpg', import.meta.url).pathname);
    await toastSays('Đã tải ảnh');
    await page.locator('input[name=slogan]').fill('Hoa tươi mỗi ngày');
    await page.getByRole('button', { name: 'Lưu cài đặt' }).click();
    await toastSays('Đã lưu cài đặt');
  });

  await step('Trang cho khách: xem mẫu, lọc, mở chi tiết', async () => {
    await page.goto(`${admin}#/san-pham`);
    await page.locator('a.item', { hasText: 'Bó hồng đỏ' }).click();
    await page.locator('textarea[name=description]').fill('Bó hoa thử nghiệm cho trang khách');
    await page.locator('#save').click();
    await toastSays('Đã lưu sản phẩm');
    await page.goto(`${base}shop/`);  // địa chỉ cũ: phải tự chuyển về trang chính
    await page.waitForURL(base);
    await page.getByRole('heading', { name: 'Mẫu hoa' }).waitFor();
    await page.locator('.hero.has-photo .hero-bg').waitFor();
    assert.equal((await page.locator('.hero h1').textContent()).trim(), 'Hoa tươi mỗi ngày', 'khẩu hiệu trên ảnh bìa');
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
    await page.goto(`${admin}#/`);
    await page.locator('#side .side-link.on', { hasText: 'Tổng quan' }).waitFor();
    assert.equal(await page.locator('#tabs').isVisible(), false, 'laptop: ẩn thanh menu dưới');
    const tops = await page.locator('.stats > .card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, '4 ô số liệu nằm trên một hàng');
    const colLefts = await page.locator('.cols-main > .col').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    assert.equal(new Set(colLefts).size, 2, 'tổng quan chia 2 cột');
    await shot('20-laptop-tong-quan');

    await page.locator('#side a[href="#/don"]').click();
    await page.getByRole('heading', { name: 'Đơn hàng' }).waitFor();
    await page.locator('#pick-range').click();
    await page.locator('dialog [data-from]', { hasText: '7 ngày tới' }).click();
    await page.locator('#pick-range.on', { hasText: '–' }).waitFor();
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

    await page.goto(base);
    await page.locator('.p-card').first().waitFor();
    assert.equal(await page.locator('.dock').isVisible(), false, 'laptop: không cần thanh nút ở đáy');
    assert.ok(await page.locator('.topbar .contacts').isVisible(), 'laptop: liên hệ trên thanh đen');
    assert.ok(await page.locator('.catnav').isVisible(), 'laptop: thanh danh mục');
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
