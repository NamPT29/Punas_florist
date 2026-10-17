// Đăng nhập, menu Thêm, Cài đặt shop, sao lưu.
import { app, refresh, reloadUser } from '../app.js';
import { html, raw, ICON, num, parseMoney, bindMoneyInputs, toast, errMsg, download, today, initials, ddmm } from '../util.js';

export async function login({ el }) {
  const noRole = app.user && !app.user.role;
  el.innerHTML = html`
    <form class="login" id="f" novalidate>
      <div class="logo">${raw(ICON.flower)}</div>
      <h1>Shop Hoa</h1>
      ${noRole ? html`
        <div class="card stack">
          <b>Tài khoản ${app.user.email} chưa được cấp quyền.</b>
          <div class="muted">Nhờ chủ shop thêm tài khoản này vào danh sách nhân viên (xem README, bước 4).</div>
        </div>
        <button class="btn" type="button" id="out">Đăng xuất</button>` : html`
        <div class="muted">Đăng nhập để quản lý shop.</div>
        <label class="field">Email<input name="email" type="email" autocomplete="username" inputmode="email" required></label>
        <label class="field">Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn btn-primary btn-lg" type="submit">Đăng nhập</button>`}
    </form>`.s;
  const f = el.querySelector('#f');
  el.querySelector('#out')?.addEventListener('click', async () => { await app.db.signOut(); app.user = null; refresh(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await app.db.signIn(f.elements.email.value.trim(), f.elements.password.value);
      await reloadUser();
      if (app.user && !app.user.role) { refresh(); return; }
      location.hash = '/';
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

export async function render({ el }) {
  const { user, settings, db } = app;
  const item = (href, icon, bg, label, attrs = '') => html`
    <a class="item" href="${href}" ${raw(attrs)} style="min-height: 56px">
      <span class="avatar" style="width: 34px; height: 34px; border-radius: 10px; ${bg}">${raw(icon)}</span>
      <span class="grow" style="font-size: 15px; font-weight: 500">${label}</span><span class="chev">›</span>
    </a>`;
  const shopUrl = new URL('shop/', `${location.origin}${location.pathname}`).href;
  el.innerHTML = html`
    <header class="top" style="justify-content: flex-start">
      <div class="avatar" style="width: 48px; height: 48px; border-radius: 24px">${initials(user.name)}</div>
      <div class="grow"><h1 style="font-size: 24px">${settings?.shop_name || 'Shop Hoa'}</h1><div class="muted">${user.name} · ${user.role === 'owner' ? 'Chủ shop' : 'Nhân viên'}</div></div>
    </header>
    <div class="page">
      <div class="cols"><div class="col">
      <div class="label-up" style="margin: 6px 4px 0">Quản lý</div>
      <nav class="list" aria-label="Quản lý">
        ${item('#/san-pham', ICON.flower, 'background: var(--rose-soft); color: var(--rose-ink)', 'Sản phẩm & công thức')}
        ${item('#/khach', ICON.user, 'background: var(--green-soft); color: var(--green)', 'Khách hàng')}
        ${item('#/thu-chi', ICON.wallet, 'background: var(--amber-soft); color: var(--amber)', 'Thu chi')}
        ${item('#/bao-cao', ICON.chart, 'background: var(--blue-soft); color: var(--blue)', 'Báo cáo')}
      </nav>
      <div class="label-up" style="margin: 6px 4px 0">Cửa hàng</div>
      <nav class="list" aria-label="Cửa hàng">
        ${item('#/cai-dat', ICON.shop, 'background: var(--gray-soft); color: var(--gray)', 'Thông tin shop, phí ship, ngày lễ')}
        <button class="item" id="backup" style="min-height: 56px">
          <span class="avatar" style="width: 34px; height: 34px; border-radius: 10px; background: var(--gray-soft); color: var(--gray)">${raw(ICON.download)}</span>
          <span class="grow" style="font-size: 15px; font-weight: 500">Sao lưu toàn bộ dữ liệu</span><span class="chev">›</span>
        </button>
      </nav>

      </div><div class="col">
      <div class="card rose stack">
        <div><b style="font-size: 15px">Trang cho khách xem hoa</b>
          <div class="small" style="color: #6B4552">Gửi link này lên Facebook, Zalo để khách xem mẫu và giá, đặt qua Zalo. Không hiện giá vốn hay kho.</div></div>
        <div class="small" style="word-break: break-all; color: var(--ink)">${shopUrl}</div>
        <div class="btns">
          <a class="btn btn-primary btn-sm" href="${shopUrl}" target="_blank" rel="noopener">Mở trang</a>
          <button class="btn btn-sm" id="share-shop">${raw(ICON.share)}Chia sẻ link</button>
        </div>
      </div>

      <div class="card green row" style="align-items: flex-start; justify-content: flex-start; gap: 12px">
        <span class="avatar" style="width: 34px; height: 34px; border-radius: 10px; background: #fff; color: var(--green)">${raw(ICON.mobile)}</span>
        <div style="font-size: 13px; line-height: 1.5"><b style="font-size: 14px">Cài lên iPhone</b><br>Mở bằng Safari → nút Chia sẻ → “Thêm vào MH chính”. App sẽ có biểu tượng như app thường.</div>
      </div>

      ${db.mode === 'demo' ? html`
        <div class="card stack">
          <b>Đang chạy bản dùng thử</b>
          <div class="muted">Dữ liệu chỉ lưu trên máy này. Khi kết nối Supabase (README), dữ liệu sẽ lưu online và dùng chung cho cả shop.</div>
          <button class="btn btn-danger" id="reset">Xóa và tạo lại dữ liệu mẫu</button>
        </div>` : html`<button class="btn btn-ghost btn-lg" id="logout">Đăng xuất</button>`}
      </div></div>
    </div>`.s;

  el.querySelector('#share-shop').onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: settings?.shop_name || 'Shop hoa', text: 'Xem mẫu hoa và bảng giá', url: shopUrl });
      else { await navigator.clipboard.writeText(shopUrl); toast('Đã sao chép link trang cho khách'); }
    } catch { /* người dùng đóng bảng chia sẻ */ }
  };
  el.querySelector('#backup').onclick = async () => {
    try {
      const data = await db.exportAll();
      download(`shop-hoa-sao-luu-${today()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 1), 'application/json');
      toast('Đã tải file sao lưu');
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  el.querySelector('#reset')?.addEventListener('click', () => {
    if (!confirm('Xóa toàn bộ dữ liệu dùng thử và tạo lại dữ liệu mẫu?')) return;
    db.reset();
    toast('Đã tạo lại dữ liệu mẫu');
    location.hash = '/';
  });
  el.querySelector('#logout')?.addEventListener('click', async () => {
    if (!confirm('Đăng xuất khỏi app?')) return;
    await db.signOut();
    app.user = null;
    location.hash = '/';
    refresh();
  });
}

const holidaysToText = (hs) => (hs || []).map((h) => `${h.slice(3, 5)}/${h.slice(0, 2)}`).join(', ');
function parseHolidays(text) {
  const out = [];
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d{1,2})[/.-](\d{1,2})$/);
    if (!m) throw new Error(`Ngày lễ "${part}" không đúng dạng ngày/tháng (VD: 20/10)`);
    const [d, mo] = [Number(m[1]), Number(m[2])];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`Ngày lễ "${part}" không hợp lệ`);
    out.push(`${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return [...new Set(out)].sort();
}

export async function settings({ el }) {
  const s = await app.db.getSettings();
  const isOwner = app.user.role === 'owner';
  el.innerHTML = html`
    <header class="top-nav"><a class="back" href="#/them">${raw(ICON.back)}Thêm</a><h1>Cài đặt shop</h1><span style="width: 52px"></span></header>
    <form class="page" id="f" novalidate>
      ${!isOwner && html`<div class="card muted">Chỉ chủ shop mới sửa được phần này.</div>`}
      <div class="cols"><div class="col">
      <section class="card stack">
        <label class="field">Tên shop<input name="shop_name" value="${s.shop_name}"></label>
        <label class="field">Số điện thoại shop<input name="phone" type="tel" value="${s.phone}"></label>
        <label class="field">Địa chỉ shop<input name="address" value="${s.address}"></label>
      </section>
      <section class="card stack">
        <h2 style="margin: 0">Trang cho khách</h2>
        <label class="field">Số Zalo nhận đặt hoa (để trống = dùng SĐT shop)<input name="zalo" type="tel" value="${s.zalo || ''}"></label>
        <label class="field">Giờ mở cửa<input name="open_hours" value="${s.open_hours || ''}" placeholder="VD: 7:00 – 21:00 hằng ngày"></label>
        <label class="field">Lời giới thiệu<textarea name="intro" rows="3" placeholder="VD: Hoa tươi mỗi ngày từ Đà Lạt, giao nhanh nội thành.">${s.intro || ''}</textarea></label>
      </section>
      </div><div class="col">
      <section class="card stack">
        <label class="field">Phí ship mặc định<input name="ship" data-money inputmode="numeric" value="${num(s.default_ship_fee)}"></label>
        <label class="field">Ngày lễ dùng giá lễ (ngày/tháng, cách nhau dấu phẩy)<input name="holidays" value="${holidaysToText(s.holidays)}" placeholder="14/2, 8/3, 20/10, 20/11, 24/12"></label>
        <div class="muted">Sản phẩm có “giá ngày lễ” sẽ tự dùng giá đó khi giao vào các ngày này. Đang đặt: ${(s.holidays || []).map((h) => ddmm(`2000-${h}`)).join(', ') || 'chưa có'}.</div>
      </section>
      ${isOwner && html`<button class="btn btn-primary btn-lg" type="submit">Lưu cài đặt</button>`}
      </div></div>
    </form>`.s;
  const f = el.querySelector('#f');
  bindMoneyInputs(el);
  if (!isOwner) f.querySelectorAll('input, textarea').forEach((i) => { i.disabled = true; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await app.db.saveSettings({
        shop_name: f.elements.shop_name.value.trim() || 'Shop Hoa',
        phone: f.elements.phone.value.trim(),
        address: f.elements.address.value.trim(),
        zalo: f.elements.zalo.value.trim(),
        open_hours: f.elements.open_hours.value.trim(),
        intro: f.elements.intro.value.trim(),
        default_ship_fee: parseMoney(f.elements.ship.value),
        holidays: parseHolidays(f.elements.holidays.value),
      });
      await reloadUser();
      toast('Đã lưu cài đặt');
      refresh({ keepScroll: true });
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  });
}
