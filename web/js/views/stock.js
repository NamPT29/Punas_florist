// Kho hoa: tồn kho, nhập, hủy héo, kiểm kho, lịch sử.
import { app, refresh, setQuery } from '../app.js';
import { html, raw, ICON, money, num, today, ddmm, timeOf, parseMoney, toast, sheet } from '../util.js';
import { reservedByMaterial, materialStatus } from '../stats.js';

const UNITS = ['cành', 'bó', 'tờ', 'cuộn', 'cái', 'kg', 'chậu'];
const MOVE = {
  nhap: ['Nhập', 'c-green'], xuat: ['Xuất đơn', 'c-blue'], huy: ['Hủy', 'c-rose'], hoan: ['Hoàn', 'c-amber'], kiem: ['Kiểm kho', ''],
};

export async function list({ el, query }) {
  const { db } = app;
  const t = today();
  const [materials, products, pending] = await Promise.all([
    db.listMaterials(), db.listProducts(), db.listOrders({ statuses: ['moi'], limit: 1000 }),
  ]);
  const mats = materialStatus(materials, reservedByMaterial(pending, products), t);
  const live = mats.filter((m) => m.active !== false);
  const f = query.f || '';
  const shown = {
    '': mats, need: live.filter((m) => m.needImport), expiring: live.filter((m) => m.expiring),
    hoa: live.filter((m) => m.kind === 'hoa'), phu_lieu: live.filter((m) => m.kind === 'phu_lieu'),
  }[f] || mats;
  const value = live.reduce((s, m) => s + Math.max(m.stock, 0) * m.cost, 0);
  const pill = (key, label) => html`<button class="pill ${f === key ? 'on' : ''}" data-f="${key}">${label}</button>`;
  const needN = live.filter((m) => m.needImport).length;
  const expN = live.filter((m) => m.expiring).length;

  el.innerHTML = html`
    <header class="top" style="flex-direction: column; align-items: stretch; gap: 12px">
      <div class="row">
        <div><h1>Kho hoa</h1><div class="muted">${live.length} loại · giá trị tồn ${money(value)}</div></div>
        <button class="btn btn-primary" id="import">+ Nhập hoa</button>
      </div>
      <div class="pills">
        ${pill('', 'Tất cả')}
        ${pill('need', `Cần nhập${needN ? ` · ${needN}` : ''}`)}
        ${pill('expiring', `Sắp héo${expN ? ` · ${expN}` : ''}`)}
        ${pill('hoa', 'Hoa')}
        ${pill('phu_lieu', 'Phụ liệu')}
        <a class="pill" href="#/kho/lich-su">${raw(ICON.history)}Lịch sử</a>
      </div>
    </header>
    <div class="page">
      ${shown.length ? html`<div class="list">
        ${shown.map((m) => {
          const cap = Math.max(m.min_stock * 2, m.reserved, 1);
          const pct = Math.max(0, Math.min(100, (m.stock / cap) * 100));
          return html`
            <div class="item" style="${m.active === false ? 'opacity: .55' : ''}">
              <button class="grow" data-edit="${m.id}" style="border: 0; background: none; padding: 0; text-align: left">
                <div class="row" style="justify-content: flex-start; flex-wrap: wrap; gap: 6px">
                  <b style="font-size: 14px">${m.name}</b>
                  ${m.active === false ? html`<span class="chip">Ngừng dùng</span>`
                    : m.needImport ? html`<span class="chip c-rose">Cần nhập</span>`
                      : m.expiring ? html`<span class="chip c-amber">Héo ${ddmm(m.expireDate)}</span>`
                        : m.kind === 'phu_lieu' ? html`<span class="chip">Phụ liệu</span>` : ''}
                </div>
                <div class="muted">${num(m.stock)}${m.min_stock ? ` / tối thiểu ${num(m.min_stock)}` : ''} ${m.unit} · ${money(m.cost)}${m.last_import && m.kind === 'hoa' ? ` · nhập ${ddmm(m.last_import)}` : ''}</div>
                ${m.reserved > 0 && html`<div class="small ${m.short ? 'neg strong' : 'muted'}">Đơn đặt trước cần ${num(m.reserved)} ${m.unit}${m.short ? ` · thiếu ${num(m.reserved - m.stock)}` : ''}</div>`}
                <div class="meter"><span class="${m.needImport ? 'low' : m.expiring ? 'warn' : ''}" style="width: ${pct}%"></span></div>
              </button>
              <button class="btn btn-sm" data-in="${m.id}">Nhập</button>
              <button class="btn btn-sm" data-out="${m.id}" ${m.stock > 0 ? '' : 'disabled'}>Hủy</button>
            </div>`;
        })}
      </div>` : html`<div class="card empty">${f ? 'Không có mục nào.' : 'Kho đang trống. Thêm loại hoa đầu tiên nhé.'}</div>`}
      <button class="btn btn-dashed" id="add">+ Thêm hoa / phụ liệu</button>
    </div>`.s;

  const byId = (id) => materials.find((m) => m.id === Number(id));
  el.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => setQuery({ f: b.dataset.f }); });
  el.querySelector('#import').onclick = () => importSheet(materials.filter((m) => m.active !== false));
  el.querySelector('#add').onclick = () => editSheet(null);
  el.querySelectorAll('[data-in]').forEach((b) => { b.onclick = () => importSheet(materials, byId(b.dataset.in)); });
  el.querySelectorAll('[data-out]').forEach((b) => { b.onclick = () => wasteSheet(byId(b.dataset.out)); });
  el.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => editSheet(byId(b.dataset.edit)); });
}

function importSheet(materials, pre) {
  if (!materials.length) { toast('Chưa có loại hoa nào, hãy thêm trước', 'error'); return; }
  const first = pre || materials[0];
  sheet({
    title: pre ? `Nhập ${pre.name}` : 'Nhập hoa',
    submit: 'Lưu phiếu nhập',
    body: html`
      ${pre ? '' : html`<label class="field">Loại hoa
        <select name="mid">${materials.map((m) => html`<option value="${m.id}">${m.name} (${m.unit})</option>`)}</select></label>`}
      <div class="grid2">
        <label class="field">Số lượng (<span data-unit>${first.unit}</span>)<input name="qty" inputmode="decimal" placeholder="0" autocomplete="off"></label>
        <label class="field">Giá nhập / <span data-unit>${first.unit}</span><input name="cost" data-money inputmode="numeric" value="${first.cost ? num(first.cost) : ''}"></label>
      </div>
      <div class="row"><span class="muted">Thành tiền (tự ghi vào Thu chi)</span><b data-sum>0đ</b></div>
      <label class="field">Nơi mua / ghi chú<input name="note" placeholder="VD: Chợ hoa Hồ Thị Kỷ"></label>
      <label class="field">Ngày nhập<input type="date" name="date" value="${today()}"></label>`,
    onMount(dlg) {
      const f = dlg.querySelector('form');
      const upd = () => {
        const m = pre || materials.find((x) => x.id === Number(f.elements.mid.value));
        dlg.querySelectorAll('[data-unit]').forEach((s) => { s.textContent = m.unit; });
        dlg.querySelector('[data-sum]').textContent = money(Number(String(f.elements.qty.value).replace(',', '.')) * parseMoney(f.elements.cost.value) || 0);
      };
      f.elements.mid?.addEventListener('change', () => {
        const m = materials.find((x) => x.id === Number(f.elements.mid.value));
        f.elements.cost.value = m.cost ? num(m.cost) : '';
        upd();
      });
      f.addEventListener('input', upd);
    },
    async onSubmit(fd) {
      const id = pre ? pre.id : Number(fd.get('mid'));
      const qty = Number(String(fd.get('qty')).replace(',', '.'));
      await app.db.importStock(id, qty, parseMoney(fd.get('cost')), fd.get('note').trim(), fd.get('date') || today());
      toast('Đã nhập kho');
      refresh({ keepScroll: true });
    },
  });
}

function wasteSheet(m) {
  sheet({
    title: `Hủy ${m.name}`, submit: 'Ghi nhận hủy', danger: true,
    body: html`
      <div class="muted">Tồn hiện tại: ${num(m.stock)} ${m.unit}. Tiền thiệt hại được tính vào báo cáo “hoa hư hỏng”.</div>
      <label class="field">Số lượng hủy (${m.unit})<input name="qty" inputmode="decimal" placeholder="0" autocomplete="off"></label>
      <div class="opts" style="grid-template-columns: repeat(3, 1fr)">
        ${['Héo', 'Dập / gãy', 'Khác'].map((r, i) => html`<label class="opt"><input type="radio" name="reason" value="${r}" ${i === 0 ? 'checked' : ''} style="accent-color: var(--rose)">&nbsp;${r}</label>`)}
      </div>
      <label class="field">Ghi chú<input name="note"></label>`,
    async onSubmit(fd) {
      const qty = Number(String(fd.get('qty')).replace(',', '.'));
      await app.db.wasteStock(m.id, qty, [fd.get('reason'), fd.get('note').trim()].filter(Boolean).join(' · '));
      toast('Đã ghi nhận hủy');
      refresh({ keepScroll: true });
    },
  });
}

function editSheet(m) {
  const isNew = !m;
  m = m || { name: '', kind: 'hoa', unit: 'cành', cost: 0, min_stock: 0, shelf_life_days: 5, active: true };
  sheet({
    title: isNew ? 'Thêm hoa / phụ liệu' : m.name,
    body: html`
      <label class="field">Tên<input name="name" value="${m.name}" placeholder="VD: Hồng đỏ Đà Lạt" autocomplete="off"></label>
      <div class="opts" style="grid-template-columns: 1fr 1fr">
        <label class="opt"><input type="radio" name="kind" value="hoa" ${m.kind === 'hoa' ? 'checked' : ''} style="accent-color: var(--rose)">&nbsp;Hoa tươi</label>
        <label class="opt"><input type="radio" name="kind" value="phu_lieu" ${m.kind === 'phu_lieu' ? 'checked' : ''} style="accent-color: var(--rose)">&nbsp;Phụ liệu</label>
      </div>
      <div class="grid2">
        <label class="field">Đơn vị<input name="unit" list="units" value="${m.unit}"></label>
        <label class="field">Giá nhập<input name="cost" data-money inputmode="numeric" value="${m.cost ? num(m.cost) : ''}"></label>
        <label class="field">Tồn tối thiểu<input name="min" inputmode="decimal" value="${m.min_stock || ''}" placeholder="0"></label>
        <label class="field" data-life>Tươi được (ngày)<input name="life" inputmode="numeric" value="${m.shelf_life_days}"></label>
      </div>
      <datalist id="units">${UNITS.map((u) => html`<option value="${u}"></option>`)}</datalist>
      ${isNew ? '' : html`
        <div class="card stack">
          <h2 style="margin: 0">Kiểm kho</h2>
          <div class="muted">Đếm thực tế rồi nhập số đúng, chênh lệch được ghi vào lịch sử.</div>
          <label class="field">Số lượng thực tế (${m.unit})<input name="actual" inputmode="decimal" value="${m.stock}"></label>
        </div>
        <label class="check"><input type="checkbox" name="active" ${m.active !== false ? 'checked' : ''}>Đang dùng (bỏ chọn để ẩn khỏi danh sách nhập)</label>
        <a class="btn btn-ghost" href="#/kho/lich-su?m=${m.id}">${raw(ICON.history)}Xem lịch sử nhập / xuất</a>`}`,
    onMount(dlg) {
      const f = dlg.querySelector('form');
      const upd = () => dlg.querySelector('[data-life]').classList.toggle('hidden', f.elements.kind.value !== 'hoa');
      f.addEventListener('change', upd);
      upd();
      dlg.querySelector('a[href^="#/kho/lich-su"]')?.addEventListener('click', () => dlg.close());
    },
    async onSubmit(fd) {
      const kind = fd.get('kind');
      const row = {
        name: fd.get('name').trim(), kind, unit: fd.get('unit').trim() || 'cành', cost: parseMoney(fd.get('cost')),
        min_stock: Number(String(fd.get('min')).replace(',', '.')) || 0,
        shelf_life_days: kind === 'hoa' ? Math.max(1, Number(fd.get('life')) || 5) : 365,
      };
      if (!row.name) throw new Error('Chưa nhập tên');
      if (!isNew) { row.id = m.id; row.active = fd.get('active') === 'on'; }
      await app.db.saveMaterial(row);
      if (!isNew) {
        const actual = Number(String(fd.get('actual')).replace(',', '.'));
        if (Number.isFinite(actual) && actual !== m.stock) await app.db.adjustStock(m.id, actual, 'Kiểm kho');
      }
      toast(isNew ? 'Đã thêm vào kho' : 'Đã lưu');
      refresh({ keepScroll: true });
    },
  });
}

export async function history({ el, query }) {
  const { db } = app;
  const materialId = query.m ? Number(query.m) : null;
  const kind = query.k || '';
  const [moves, materials] = await Promise.all([
    db.listStockMoves({ materialId, kind: kind || undefined, limit: 300 }), db.listMaterials(),
  ]);
  const mat = materials.find((m) => m.id === materialId);
  const pill = (key, label) => html`<button class="pill ${kind === key ? 'on' : ''}" data-k="${key}">${label}</button>`;
  el.innerHTML = html`
    <header class="top-nav"><a class="back" href="#/kho">${raw(ICON.back)}Kho</a><h1>${mat ? mat.name : 'Lịch sử kho'}</h1><span style="width: 52px"></span></header>
    <div class="page">
      <div class="pills">${pill('', 'Tất cả')}${pill('nhap', 'Nhập')}${pill('xuat', 'Xuất đơn')}${pill('huy', 'Hủy')}${pill('kiem', 'Kiểm kho')}</div>
      ${moves.length ? html`<div class="list">
        ${moves.map((mv) => html`
          <div class="item">
            <span class="chip ${MOVE[mv.kind]?.[1] || ''}">${MOVE[mv.kind]?.[0] || mv.kind}</span>
            <div class="grow">
              <div class="title">${mat ? '' : `${mv.material?.name || ''} · `}<span class="${mv.qty < 0 ? 'neg' : 'pos'}">${mv.qty > 0 ? '+' : ''}${num(mv.qty)} ${mv.material?.unit || ''}</span></div>
              <div class="muted">${timeOf(mv.created_at)}${mv.note ? ` · ${mv.note}` : ''}</div>
            </div>
            ${mv.order_id ? html`<a class="link-btn" href="#/don/${mv.order_id}">#${mv.order_id}</a>` : ''}
          </div>`)}
      </div>` : html`<div class="card empty">Chưa có lịch sử.</div>`}
    </div>`.s;
  el.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => setQuery({ k: b.dataset.k }); });
}
