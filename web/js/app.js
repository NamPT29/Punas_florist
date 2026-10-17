// Khung ứng dụng: chọn backend, đăng nhập, điều hướng theo #hash, thanh menu dưới.
import { loadBackend } from './backend.js';
import { html, raw, ICON, errMsg, toast, initials } from './util.js';
import * as home from './views/home.js';
import * as orders from './views/orders.js';
import * as stock from './views/stock.js';
import * as products from './views/products.js';
import * as customers from './views/customers.js';
import * as finance from './views/finance.js';
import * as more from './views/more.js';

export const app = { db: null, user: null, settings: null };

const ROUTES = [
  [/^\/$/, home.render, 'home'],
  [/^\/don$/, orders.list, 'orders'],
  [/^\/don\/moi$/, orders.create, null],
  [/^\/don\/(\d+)$/, orders.detail, null],
  [/^\/kho$/, stock.list, 'stock'],
  [/^\/kho\/lich-su$/, stock.history, 'stock'],
  [/^\/san-pham$/, products.list, 'more'],
  [/^\/san-pham\/(moi|\d+)$/, products.edit, null],
  [/^\/khach$/, customers.list, 'more'],
  [/^\/khach\/(\d+)$/, customers.detail, 'more'],
  [/^\/thu-chi$/, finance.expenses, 'more'],
  [/^\/bao-cao$/, finance.report, 'more'],
  [/^\/them$/, more.render, 'more'],
  [/^\/cai-dat$/, more.settings, 'more'],
];

const TABS = [
  ['home', '#/', 'Tổng quan', ICON.home],
  ['orders', '#/don', 'Đơn hàng', ICON.orders],
  ['add', '#/don/moi', 'Tạo đơn', ICON.plus],
  ['stock', '#/kho', 'Kho', ICON.box],
  ['more', '#/them', 'Thêm', ICON.more],
];

function renderTabs(active) {
  document.getElementById('tabs').innerHTML = TABS.map(([key, href, label, icon]) => (key === 'add'
    ? html`<a href="${href}" class="tab-add" aria-label="${label}">${raw(icon)}</a>`
    : html`<a href="${href}" class="tab ${key === active ? 'on' : ''}" ${key === active ? raw('aria-current="page"') : ''}>${raw(icon)}<span>${label}</span></a>`).s).join('');
}

// Menu trái trên máy tính / iPad ngang (CSS ẩn trên điện thoại).
const SIDE = [
  ['/', 'Tổng quan', ICON.home],
  ['/don', 'Đơn hàng', ICON.orders],
  ['/kho', 'Kho hoa', ICON.box],
  ['/san-pham', 'Sản phẩm', ICON.flower],
  ['/khach', 'Khách hàng', ICON.user],
  ['/thu-chi', 'Thu chi', ICON.wallet],
  ['/bao-cao', 'Báo cáo', ICON.chart],
  ['/cai-dat', 'Cài đặt shop', ICON.shop],
  ['/them', 'Khác', ICON.more],
];

function renderSide(path) {
  const isOn = (p) => (p === '/' ? path === '/' : path === p || (path.startsWith(`${p}/`) && path !== '/don/moi'));
  const current = (on) => (on ? raw('aria-current="page"') : '');
  document.getElementById('side').innerHTML = html`
    <a class="side-brand" href="#/">
      <img src="../icons/icon.svg" alt="">
      <span><b>${app.settings?.shop_name || 'Shop Hoa'}</b><small>Quản lý shop hoa</small></span>
    </a>
    <a class="btn btn-primary side-create" href="#/don/moi" ${current(path === '/don/moi')}>${raw(ICON.plus)}Tạo đơn</a>
    <nav class="side-nav">
      ${SIDE.map(([p, label, icon]) => html`<a class="side-link ${isOn(p) ? 'on' : ''}" href="#${p}" ${current(isOn(p))}>${raw(icon)}<span>${label}</span></a>`)}
    </nav>
    <div class="side-foot">
      <a class="side-link" href="../" target="_blank" rel="noopener">${raw(ICON.share)}<span>Trang cho khách</span></a>
      <div class="side-user"><span class="avatar">${initials(app.user.name)}</span>
        <span><b>${app.user.name}</b><small>${app.user.role === 'owner' ? 'Chủ shop' : 'Nhân viên'}</small></span></div>
    </div>`.s;
}

export function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function go(path) {
  if (location.hash === `#${path}`) refresh();
  else location.hash = path;
}

/** Đổi tham số trên URL (bộ lọc) mà không thêm lịch sử. */
export function setQuery(patch) {
  const { path, query } = parseHash();
  const q = new URLSearchParams({ ...query, ...patch });
  for (const [k, v] of [...q]) if (v === '' || v == null) q.delete(k);
  const s = q.toString();
  history.replaceState(null, '', `#${path}${s ? `?${s}` : ''}`);
  refresh();
}

let renderToken = 0;
/** Vẽ lại màn hiện tại. keepScroll: giữ nguyên vị trí cuộn (cập nhật tại chỗ). */
export async function refresh({ keepScroll = false } = {}) {
  const token = ++renderToken;
  const root = document.getElementById('app');
  const { path, query } = parseHash();

  if (!app.user?.role) {
    document.body.classList.add('no-tabs');
    document.body.classList.remove('has-side');
    const el = document.createElement('div');
    await more.login({ el });
    if (token === renderToken) root.replaceChildren(el);
    return;
  }

  const route = ROUTES.find(([re]) => re.test(path));
  if (!route) { location.hash = '/'; return; }
  const [re, view, tab] = route;
  const params = path.match(re).slice(1);
  document.body.classList.toggle('no-tabs', tab === null);
  document.body.classList.add('has-side');
  renderSide(path);
  if (tab) renderTabs(tab);

  if (!root.firstChild) root.innerHTML = '<div class="loading">Đang tải…</div>';
  const el = document.createElement('div');
  try {
    await view({ el, params, query });
  } catch (e) {
    console.error(e);
    el.innerHTML = html`
      <div class="page" style="padding-top: 40px">
        <div class="card stack">
          <h2>Không tải được dữ liệu</h2>
          <div class="muted">${errMsg(e)}</div>
          <button class="btn btn-primary" data-retry>Thử lại</button>
        </div>
      </div>`.s;
    el.querySelector('[data-retry]').onclick = () => refresh();
  }
  if (token !== renderToken) return;
  root.replaceChildren(el);
  if (!keepScroll) window.scrollTo(0, 0);
}

export async function reloadUser() {
  app.user = await app.db.getUser();
  app.settings = app.user?.role ? await app.db.getSettings() : null;
  document.title = app.settings?.shop_name || 'Shop Hoa';
}

async function start() {
  try {
    app.db = await loadBackend();
    if (app.db.mode === 'demo') document.getElementById('demo').classList.remove('hidden');
    await reloadUser();
  } catch (e) {
    console.error(e);
    toast(errMsg(e), 'error');
  }
  window.addEventListener('hashchange', () => refresh());
  await refresh();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Mở lại app sau một lúc (iPhone giữ app chạy nền): tải lại số liệu mới.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (app.user && Date.now() - hiddenAt > 60000 && !document.body.classList.contains('no-tabs') && !document.querySelector('dialog[open]')) refresh({ keepScroll: true });
});

start();
