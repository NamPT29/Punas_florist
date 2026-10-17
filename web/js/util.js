// Tiện ích dùng chung: dựng HTML an toàn, định dạng tiền/ngày/SĐT, toast, bottom sheet, ảnh.

// ---------- HTML ----------
export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(s);

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function part(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

/** Template tag: mọi giá trị được escape, trừ raw()/html`` lồng nhau. */
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Raw(out);
}

// ---------- Tiền ----------
const nf = new Intl.NumberFormat('vi-VN');
export const money = (n) => `${nf.format(Math.round(Number(n) || 0))}đ`;
export const num = (n) => nf.format(Number(n) || 0);

/** 38600000 → "38,6 tr", 640000 → "640k". */
export function moneyShort(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (abs >= 1e3) return `${Math.round(v / 1e3)}k`;
  return nf.format(v);
}

export const parseMoney = (s) => Number(String(s ?? '').replace(/\D/g, '')) || 0;

/** Ô nhập tiền: tự thêm dấu chấm khi gõ. */
export function bindMoneyInputs(root) {
  root.querySelectorAll('input[data-money]').forEach((el) => {
    el.addEventListener('input', () => {
      const v = parseMoney(el.value);
      el.value = v ? nf.format(v) : '';
    });
  });
}

// ---------- Ngày (theo giờ máy, VN) ----------
const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoOf(new Date());
export const parseIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export function addDays(iso, n) { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoOf(d); }
export const monthOf = (iso) => iso.slice(0, 7);
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: isoOf(new Date(y, m, 0)) };
}
export const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000);

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WD_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
export const dateShort = (iso) => (iso ? `${WD[parseIso(iso).getDay()]}, ${ddmm(iso)}` : '');
export const dateLong = (iso) => (iso ? `${WD_LONG[parseIso(iso).getDay()]}, ${ddmm(iso)}` : '');
export function dateRelative(iso) {
  const diff = daysBetween(today(), iso);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  if (diff === -1) return 'Hôm qua';
  return dateShort(iso);
}
export const monthLabel = (month) => `Tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`;
export function timeOf(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// ---------- SĐT ----------
export const phoneDigits = (s) => String(s ?? '').replace(/\D/g, '');
export function phoneFmt(s) {
  const d = phoneDigits(s);
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (d.length === 11) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  return d;
}

// ---------- Trạng thái đơn ----------
export const STATUS = {
  moi: { label: 'Mới', cls: 'st-new', next: 'dang_cam', nextLabel: 'Bắt đầu cắm' },
  dang_cam: { label: 'Đang cắm', cls: 'st-make', next: 'dang_giao', nextLabel: 'Chuyển: Đang giao' },
  dang_giao: { label: 'Đang giao', cls: 'st-ship', next: 'da_giao', nextLabel: 'Đã giao xong' },
  da_giao: { label: 'Đã giao', cls: 'st-done' },
  huy: { label: 'Đã hủy', cls: 'st-cancel' },
};
export const PAYMENT = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản', the: 'Thẻ', vi: 'Ví điện tử' };
export const statusChip = (s) => html`<span class="chip ${STATUS[s]?.cls}">${STATUS[s]?.label ?? s}</span>`;

/** "08–10h" → "08:00", "14:30" → "14:30". */
export function slotStart(slot) {
  const m = (slot || '').match(/^(\d{1,2})(?::(\d{2}))?/);
  return m ? `${m[1].padStart(2, '0')}:${m[2] || '00'}` : (slot || '—');
}
export const itemsLabel = (o) => (o.items || []).map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(', ');
export const placeLabel = (o) => (o.pickup ? 'Lấy tại shop' : (o.address || '').split(',').slice(-1)[0].trim() || 'Chưa có địa chỉ');

// ---------- Toast ----------
let toastTimer;
export function toast(msg, kind = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, kind === 'error' ? 4500 : 2500);
}
export const errMsg = (e) => {
  const m = e?.message || String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Mất kết nối mạng, thử lại sau.';
  return m;
};

// ---------- Bottom sheet ----------
/**
 * Mở bottom sheet chứa form. onSubmit(formData, form) trả về true/undefined để đóng, false để giữ.
 * Trả về phần tử <dialog> để gắn thêm sự kiện nếu cần.
 */
export function sheet({ title, body, submit = 'Lưu', onSubmit, onMount, danger, wide }) {
  const dlg = document.createElement('dialog');
  dlg.className = wide ? 'sheet wide' : 'sheet';
  dlg.innerHTML = html`
    <form method="dialog" class="sheet-form" novalidate>
      <div class="sheet-head">
        <h2>${title}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Đóng">${raw(ICON.close)}</button>
      </div>
      <div class="sheet-body">${body}</div>
      ${onSubmit ? html`<div class="sheet-foot"><button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" type="submit">${submit}</button></div>` : ''}
    </form>`.s;
  document.body.appendChild(dlg);
  const form = dlg.querySelector('form');
  const close = () => { dlg.close(); };
  dlg.addEventListener('close', () => dlg.remove());
  dlg.querySelector('[data-close]').addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  bindMoneyInputs(dlg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const keep = await onSubmit(new FormData(form), form);
      if (keep !== false) close();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      btn.disabled = false;
    }
  });
  onMount?.(dlg, close);
  dlg.showModal();
  return dlg;
}

// ---------- Ảnh: thu nhỏ trước khi tải lên ----------
export async function shrinkImage(file, maxSide = 1280, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** CSV mở được bằng Excel (UTF-8 có BOM để hiện đúng tiếng Việt). */
export function toCsv(rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`;
}

export const initials = (name) => (String(name || '?').trim().split(/\s+/).pop() || '?')[0].toUpperCase();

// ---------- Icon (stroke SVG) ----------
const svg = (d, size = 22, sw = 1.8) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  orders: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 26, 2.2),
  box: svg('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>'),
  more: svg('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 18, 2),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', 18),
  print: svg('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 26),
  share: svg('<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>', 18),
  flower: svg('<circle cx="12" cy="8" r="3"/><path d="M12 11v10M12 16c-2-2-5-2-6-1M12 18c2-2 5-2 6-1"/>', 18),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', 18),
  wallet: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>', 18),
  chart: svg('<path d="M5 20V10M12 20V4M19 20v-7"/>', 18),
  shop: svg('<path d="M4 10h16l-1-5H5zM5 10v10h14V10M10 20v-5h4v5"/>', 18),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 18),
  mobile: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', 18),
  bell: svg('<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 18),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', 18),
  chat: svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>', 20),
  pin: svg('<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>', 18),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 18),
  logo: svg('<circle cx="12" cy="9" r="2.2"/><path d="M12 6.8C11 3.5 13 3.5 12 6.8M14.2 9c3.3-1 3.3 1 0 0M9.8 9c-3.3-1-3.3 1 0 0M12 11.2c-1 3.3 1 3.3 0 0M12 13v8M12 17c2-2 4-2 5-1.5"/>', 16),
};
