// Sản phẩm (mẫu bó hoa) và công thức: giá vốn, lãi, giá ngày lễ. Sản phẩm cùng loại xếp vào nhóm (như thư mục).
import { app, refresh } from '../app.js';
import { html, raw, ICON, money, moneyShort, num, parseMoney, bindMoneyInputs, toast, errMsg, sheet, shrinkImage, fold } from '../util.js';
import { productCost } from '../stats.js';

const photoSize = () => (app.db.mode === 'demo' ? 480 : 1000);

function productItem(p, materials, groupName) {
  const cost = productCost(p, materials);
  const margin = p.price ? (p.price - cost) / p.price : 0;
  return html`
    <a class="item" href="#/san-pham/${p.id}" data-name="${fold(`${p.name} ${groupName || ''}`)}" style="${p.active ? '' : 'opacity: .55'}">
      ${p.photo_url ? html`<img class="thumb" src="${p.photo_url}" alt="" loading="lazy">` : html`<div class="thumb"></div>`}
      <div class="grow">
        <div class="title">${p.name}${p.active ? '' : html` <span class="chip">Ngừng bán</span>`}</div>
        <div class="muted">${money(p.price)}${p.holiday_price != null ? ` · lễ ${money(p.holiday_price)}` : ''}${groupName ? ` · ${groupName}` : ''}</div>
        <div class="small ${margin < 0.3 ? 'neg' : 'pos'}">Vốn ${money(cost)} · lãi ${Math.round(margin * 100)}%</div>
      </div>
      <span class="chev">›</span>
    </a>`;
}

/** Ảnh nhóm: ảnh chủ shop chọn, chưa có thì lấy ảnh sản phẩm đầu tiên trong nhóm. */
const coverOf = (g, items) => g.photo_url || items.find((p) => p.photo_url)?.photo_url || null;

function folderCard(g, items) {
  const cover = coverOf(g, items);
  const prices = items.filter((p) => p.active).map((p) => p.price);
  return html`
    <a class="folder" href="#/san-pham/nhom/${g.id}">
      <div class="folder-img">${cover ? html`<img src="${cover}" alt="" loading="lazy">` : raw(ICON.flower)}</div>
      <div class="folder-body">
        <div class="title">${g.name}</div>
        <div class="muted small">${items.length} mẫu${prices.length ? ` · từ ${moneyShort(Math.min(...prices))}` : ''}</div>
      </div>
    </a>`;
}

/** Tải ảnh lên (thu nhỏ trước), trả về link. */
async function upload(file) {
  return app.db.uploadPhoto(await shrinkImage(file, photoSize()), 'groups');
}

const coverHint = () => html`${raw(ICON.camera)}<span>Thêm ảnh đại diện<br><span class="small muted">chọn ảnh hoa đẹp nhất của nhóm</span></span>`;

/** Hộp tạo / sửa nhóm: tên và ảnh đại diện. */
function groupSheet(g, onSaved) {
  let photo = g?.photo_url || null;
  let uploading = null;
  const preview = () => (photo ? html`<img src="${photo}" alt=""><span class="group-cover-btn">${raw(ICON.camera)}Đổi ảnh</span>` : coverHint());
  sheet({
    title: g ? 'Sửa nhóm' : 'Nhóm mới',
    submit: g ? 'Lưu nhóm' : 'Tạo nhóm',
    body: html`
      <label class="group-cover ${photo ? '' : 'empty'}" id="gcover" aria-label="Ảnh đại diện nhóm">
        <span class="group-cover-in" id="gprev">${preview()}</span>
        <input type="file" accept="image/*" id="gfile">
      </label>
      <label class="field">Tên nhóm<input name="name" value="${g?.name || ''}" placeholder="VD: Hoa hồng Plume" autocomplete="off"></label>
      ${g ? html`<button type="button" class="btn btn-danger" id="gdel">${raw(ICON.trash)}Xóa nhóm</button>
        <div class="muted small" style="margin-top: -4px">Xóa nhóm không xóa sản phẩm, sản phẩm chuyển về "Chưa xếp nhóm".</div>` : ''}`,
    onMount(dlg, close) {
      const $ = (sel) => dlg.querySelector(sel);
      $('#gfile').addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        $('#gprev').textContent = 'Đang tải ảnh…';
        uploading = upload(file)
          .then((url) => { photo = url; })
          .catch((err) => toast(errMsg(err), 'error'))
          .finally(() => {
            $('#gcover').classList.toggle('empty', !photo);
            $('#gprev').innerHTML = preview().s;
            uploading = null;
          });
      });
      $('#gdel')?.addEventListener('click', async () => {
        if (!confirm(`Xóa nhóm "${g.name}"? Sản phẩm trong nhóm vẫn giữ nguyên.`)) return;
        try {
          await app.db.deleteGroup(g.id);
          close();
          toast('Đã xóa nhóm');
          location.replace('#/san-pham');
        } catch (err) { toast(errMsg(err), 'error'); }
      });
    },
    async onSubmit(fd) {
      if (uploading) await uploading;
      const id = await app.db.saveGroup({ id: g?.id || null, name: fd.get('name'), photo_url: photo });
      toast(g ? 'Đã lưu nhóm' : 'Đã tạo nhóm');
      onSaved(id);
    },
  });
}

export async function list({ el }) {
  const { db } = app;
  const [products, materials, groups] = await Promise.all([db.listProducts(), db.listMaterials(), db.listGroups()]);
  const groupName = (p) => groups.find((g) => g.id === p.group_id)?.name || '';
  const loose = products.filter((p) => !groupName(p));
  el.innerHTML = html`
    <header class="top-nav"><a class="back" href="#/them">${raw(ICON.back)}Thêm</a><h1>Sản phẩm</h1><a class="btn btn-sm btn-primary" href="#/san-pham/moi" style="margin-right: 8px">+ Sản phẩm</a></header>
    <div class="page">
      <label class="search">${raw(ICON.search)}<input type="search" id="q" placeholder="Tìm sản phẩm hoặc nhóm…" aria-label="Tìm sản phẩm" autocomplete="off"></label>
      <div class="page-part" id="browse">
        <div class="sec"><h2>Nhóm sản phẩm</h2><span class="muted small">${groups.length} nhóm</span></div>
        <div class="folders">
          ${groups.map((g) => folderCard(g, products.filter((p) => p.group_id === g.id)))}
          <button type="button" class="folder folder-add" id="add-group">${raw(ICON.plus)}<span>Nhóm mới</span></button>
        </div>
        ${loose.length ? html`
          <div class="sec"><h2>Chưa xếp nhóm</h2><span class="muted small">${loose.length} mẫu</span></div>
          ${groups.length ? '' : html`<div class="muted small">Tạo nhóm cho các mẫu cùng loại (VD "Hoa hồng Plume"), rồi vào nhóm bấm "Chuyển mẫu vào".</div>`}
          <div class="list list-grid">${loose.map((p) => productItem(p, materials))}</div>` : ''}
        ${products.length ? '' : html`<div class="card empty">Chưa có sản phẩm nào.<br><a class="btn btn-outline" href="#/san-pham/moi">+ Thêm sản phẩm đầu tiên</a></div>`}
      </div>
      <div class="page-part hidden" id="results">
        <div class="list list-grid">${products.map((p) => productItem(p, materials, groupName(p)))}</div>
        <div class="card empty hidden" id="none">Không thấy sản phẩm nào.</div>
      </div>
    </div>`.s;
  el.querySelector('#q').addEventListener('input', (e) => {
    const words = fold(e.target.value).split(/\s+/).filter(Boolean);
    el.querySelector('#browse').classList.toggle('hidden', words.length > 0);
    el.querySelector('#results').classList.toggle('hidden', !words.length);
    let shown = 0;
    el.querySelectorAll('#results [data-name]').forEach((a) => {
      const ok = words.every((w) => a.dataset.name.includes(w));
      a.classList.toggle('hidden', !ok);
      shown += ok;
    });
    el.querySelector('#none').classList.toggle('hidden', shown > 0);
  });
  el.querySelector('#add-group').onclick = () => groupSheet(null, (id) => { location.hash = `#/san-pham/nhom/${id}`; });
}

/** Bên trong một nhóm: ảnh đại diện, các sản phẩm, thêm / chuyển sản phẩm vào. */
export async function group({ el, params }) {
  const { db } = app;
  const gid = Number(params[0]);
  const [products, materials, groups] = await Promise.all([db.listProducts(), db.listMaterials(), db.listGroups()]);
  const g = groups.find((x) => x.id === gid);
  if (!g) throw new Error('Không tìm thấy nhóm (có thể đã bị xóa)');
  const items = products.filter((p) => p.group_id === gid);
  const others = products.filter((p) => p.group_id !== gid);
  const groupName = (p) => groups.find((x) => x.id === p.group_id)?.name || '';

  el.innerHTML = html`
    <header class="top-nav"><a class="back" href="#/san-pham">${raw(ICON.back)}Sản phẩm</a><h1>${g.name}</h1><button type="button" class="btn btn-sm btn-outline" id="edit" style="margin-right: 8px">Sửa nhóm</button></header>
    <div class="page">
      <label class="group-cover ${g.photo_url ? '' : 'empty'}" aria-label="Ảnh đại diện nhóm">
        <span class="group-cover-in">${g.photo_url
          ? html`<img src="${g.photo_url}" alt="${g.name}"><span class="group-cover-btn">${raw(ICON.camera)}Đổi ảnh</span>`
          : coverHint()}</span>
        <input type="file" accept="image/*" id="cover">
      </label>
      <div class="grid2 group-actions">
        <a class="btn btn-primary" href="#/san-pham/moi?g=${gid}">+ Sản phẩm mới</a>
        <button type="button" class="btn btn-outline" id="move-in" ${others.length ? '' : 'disabled'}>Chuyển mẫu vào</button>
      </div>
      <div class="sec"><h2>Sản phẩm trong nhóm</h2><span class="muted small">${items.length} mẫu</span></div>
      ${items.length
        ? html`<div class="list list-grid">${items.map((p) => productItem(p, materials))}</div>`
        : html`<div class="card empty">Nhóm chưa có sản phẩm.<br>Bấm "+ Sản phẩm mới" hoặc "Chuyển mẫu vào".</div>`}
    </div>`.s;

  el.querySelector('#edit').onclick = () => groupSheet(g, () => refresh({ keepScroll: true }));
  el.querySelector('#cover').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    el.querySelector('.group-cover-in').textContent = 'Đang tải ảnh…';
    try {
      await db.saveGroup({ ...g, photo_url: await upload(file) });
      toast('Đã đổi ảnh nhóm');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
    refresh({ keepScroll: true });
  });
  el.querySelector('#move-in').onclick = () => {
    // Mẫu chưa có nhóm lên trước.
    const rows = [...others].sort((a, b) => Number(a.group_id != null) - Number(b.group_id != null));
    sheet({
      title: `Chuyển vào "${g.name}"`,
      submit: 'Chuyển vào nhóm',
      body: html`
        ${rows.length > 6 ? html`<label class="search">${raw(ICON.search)}<input type="search" id="mq" placeholder="Tìm sản phẩm…" aria-label="Tìm sản phẩm" autocomplete="off"></label>` : ''}
        <div class="list pick-list">
          ${rows.map((p) => html`
            <label class="item check-item" data-name="${fold(p.name)}">
              <input type="checkbox" name="pid" value="${p.id}">
              ${p.photo_url ? html`<img class="thumb" src="${p.photo_url}" alt="" loading="lazy">` : html`<div class="thumb"></div>`}
              <div class="grow"><div class="title">${p.name}</div><div class="muted small">${groupName(p) ? `Đang ở nhóm ${groupName(p)}` : 'Chưa xếp nhóm'}</div></div>
            </label>`)}
        </div>`,
      onMount(dlg) {
        dlg.querySelector('#mq')?.addEventListener('input', (e) => {
          const words = fold(e.target.value).split(/\s+/).filter(Boolean);
          dlg.querySelectorAll('[data-name]').forEach((r) => r.classList.toggle('hidden', !words.every((w) => r.dataset.name.includes(w))));
        });
      },
      async onSubmit(fd) {
        const ids = fd.getAll('pid').map(Number);
        if (!ids.length) { toast('Chọn ít nhất một sản phẩm', 'error'); return false; }
        await db.moveProducts(ids, gid);
        toast(`Đã chuyển ${ids.length} sản phẩm vào nhóm`);
        refresh({ keepScroll: true });
      },
    });
  };
}

export async function edit({ el, params, query }) {
  const { db } = app;
  const [products, materials, groups] = await Promise.all([db.listProducts(), db.listMaterials(), db.listGroups()]);
  const isNew = params[0] === 'moi';
  const p = isNew
    ? { name: '', group_id: groups.some((g) => g.id === Number(query.g)) ? Number(query.g) : null,
      description: '', categories: [], price: 0, holiday_price: null, photo_url: null, active: true, components: [] }
    : products.find((x) => x.id === Number(params[0]));
  if (!p) throw new Error('Không tìm thấy sản phẩm');
  const st = { ...p, components: p.components.map((c) => ({ ...c })) };
  const usable = materials.filter((m) => m.active !== false || st.components.some((c) => c.material_id === m.id));
  const knownCats = [...new Set(products.flatMap((x) => x.categories || []))];
  // Quay về nhóm đang xem (nếu có).
  const backTo = (gid) => (groups.some((g) => g.id === gid) ? `#/san-pham/nhom/${gid}` : '#/san-pham');
  const backGroup = groups.find((g) => g.id === p.group_id);

  el.innerHTML = html`
    <header class="top-nav">
      <a class="back" href="${backTo(p.group_id)}">${raw(ICON.back)}${backGroup?.name || 'Sản phẩm'}</a><h1>${isNew ? 'Sản phẩm mới' : ''}</h1>
      <label class="check" style="margin-right: 8px; color: var(--green); font-weight: 600"><input type="checkbox" id="active" ${st.active ? 'checked' : ''} style="accent-color: var(--green)">Đang bán</label>
    </header>
    <form class="page" id="f" novalidate>
      <div class="cols"><div class="col">
      <div class="row" style="justify-content: flex-start; gap: 12px">
        <label class="photo-drop" style="width: 104px; height: 104px; min-height: 0; flex-shrink: 0; padding: 0" aria-label="Ảnh sản phẩm">
          <span id="photo-box">${st.photo_url ? html`<img src="${st.photo_url}" alt="" style="width: 104px; height: 104px; object-fit: cover">` : html`${raw(ICON.camera)}<span class="small">Thêm ảnh</span>`}</span>
          <input type="file" accept="image/*" id="photo">
        </label>
        <div class="grow stack">
          <label class="field">Tên sản phẩm<input name="name" value="${st.name}" placeholder="VD: Bó hồng đỏ 20 bông"></label>
        </div>
      </div>
      <label class="field">Nhóm
        <select name="group">
          <option value="">Chưa xếp nhóm</option>
          ${groups.map((g) => html`<option value="${g.id}" ${g.id === st.group_id ? 'selected' : ''}>${g.name}</option>`)}
        </select>
      </label>
      <label class="field">Dịp, để khách lọc trên trang cửa hàng (cách nhau bởi dấu phẩy)<input name="cats" list="cats" value="${st.categories.join(', ')}" placeholder="Sinh nhật, Tình yêu"></label>
      <datalist id="cats">${knownCats.map((c) => html`<option value="${c}"></option>`)}</datalist>
      <label class="field">Mô tả cho khách (hiện trên trang cửa hàng)<textarea name="description" rows="2" placeholder="VD: 20 hồng đỏ Đà Lạt, điểm baby trắng, gói giấy kraft.">${st.description || ''}</textarea></label>

      <section class="card stack">
        <div class="row"><h2 style="margin: 0">Công thức bó hoa</h2><span class="muted">tự trừ kho khi cắm</span></div>
        <div id="comps" class="stack"></div>
        <button type="button" class="btn btn-dashed" id="add-comp" ${usable.length ? '' : 'disabled'}>+ Thêm hoa / phụ liệu</button>
        ${usable.length ? '' : html`<div class="muted">Thêm hoa vào <a href="#/kho">Kho</a> trước để lập công thức.</div>`}
      </section>
      </div><div class="col">
      <section class="card green">
        <div class="grid3" style="text-align: center; align-items: end">
          <div><div class="muted">Giá vốn</div><b style="font-size: 16px" id="cost"></b></div>
          <label class="field" style="text-align: center">Giá bán<input name="price" data-money inputmode="numeric" value="${st.price ? num(st.price) : ''}" style="text-align: center; font-weight: 700"></label>
          <div><div class="muted">Lãi</div><b style="font-size: 16px" id="profit"></b><div class="small strong" id="pct"></div></div>
        </div>
      </section>

      <section class="card stack">
        <h2 style="margin: 0">Giá ngày lễ</h2>
        <div class="muted">Tự áp dụng khi ngày giao là ngày lễ trong Cài đặt (14/2, 8/3, 20/10…). Để trống nếu không đổi giá.</div>
        <input class="inp" name="holiday" data-money inputmode="numeric" value="${st.holiday_price != null ? num(st.holiday_price) : ''}" placeholder="Giống giá thường" aria-label="Giá ngày lễ">
      </section>
      </div></div>
    </form>
    <div class="footer-bar"><div><button class="btn btn-primary btn-lg btn-block" id="save">Lưu sản phẩm</button></div></div>`.s;

  const f = el.querySelector('#f');
  f.addEventListener('submit', (e) => e.preventDefault());
  bindMoneyInputs(el);
  const $ = (s) => el.querySelector(s);
  const matOf = (id) => materials.find((m) => m.id === id);

  function drawComps() {
    $('#comps').innerHTML = st.components.length ? st.components.map((c, i) => {
      const m = matOf(c.material_id);
      return html`
        <div class="row" style="gap: 8px">
          <select class="inp grow" data-cm="${i}" aria-label="Hoa / phụ liệu">
            ${usable.map((x) => html`<option value="${x.id}" ${x.id === c.material_id ? 'selected' : ''}>${x.name}</option>`)}
          </select>
          <input class="inp" data-cq="${i}" inputmode="decimal" value="${c.qty}" style="width: 70px; text-align: center" aria-label="Số lượng">
          <span class="muted" style="width: 36px">${m?.unit}</span>
          <button type="button" class="icon-btn plain" data-cdel="${i}" aria-label="Bỏ">${raw(ICON.close)}</button>
        </div>`.s;
    }).join('') : '<div class="muted">Chưa có thành phần. Không bắt buộc, nhưng có công thức thì kho tự trừ và biết lãi.</div>';
    drawMoney();
  }
  function drawMoney() {
    const price = parseMoney(f.elements.price.value);
    const cost = productCost(st, materials);
    $('#cost').textContent = money(cost);
    $('#profit').textContent = money(price - cost);
    $('#profit').className = price - cost >= 0 ? 'pos' : 'neg';
    $('#pct').textContent = price ? `${Math.round(((price - cost) / price) * 100)}%` : '';
  }

  el.addEventListener('change', (e) => {
    if (e.target.dataset.cm) { st.components[e.target.dataset.cm].material_id = Number(e.target.value); drawComps(); }
  });
  el.addEventListener('input', (e) => {
    if (e.target.dataset.cq) { st.components[e.target.dataset.cq].qty = Number(e.target.value.replace(',', '.')) || 0; drawMoney(); }
    if (e.target.name === 'price') drawMoney();
  });
  el.addEventListener('click', (e) => {
    const del = e.target.closest('[data-cdel]');
    if (del) { st.components.splice(Number(del.dataset.cdel), 1); drawComps(); }
  });
  $('#add-comp').onclick = () => {
    const unused = usable.find((m) => !st.components.some((c) => c.material_id === m.id)) || usable[0];
    st.components.push({ material_id: unused.id, qty: 1 });
    drawComps();
  };
  $('#photo').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    $('#photo-box').textContent = 'Đang tải…';
    try {
      st.photo_url = await db.uploadPhoto(await shrinkImage(file, photoSize()), 'products');
      $('#photo-box').innerHTML = html`<img src="${st.photo_url}" alt="" style="width: 104px; height: 104px; object-fit: cover">`.s;
    } catch (err) {
      toast(errMsg(err), 'error');
      $('#photo-box').textContent = 'Thử lại';
    }
  });
  $('#save').onclick = async () => {
    const btn = $('#save');
    const holiday = f.elements.holiday.value.trim();
    const payload = {
      id: isNew ? null : p.id,
      name: f.elements.name.value.trim(),
      group_id: Number(f.elements.group.value) || null,
      description: f.elements.description.value.trim(),
      categories: f.elements.cats.value.split(',').map((s) => s.trim()).filter(Boolean),
      price: parseMoney(f.elements.price.value),
      holiday_price: holiday ? parseMoney(holiday) : null,
      photo_url: st.photo_url,
      active: $('#active').checked,
      components: st.components.filter((c) => c.qty > 0),
    };
    if (!payload.name) return toast('Chưa nhập tên sản phẩm', 'error');
    if (!payload.price) return toast('Chưa nhập giá bán', 'error');
    btn.disabled = true;
    try {
      await db.saveProduct(payload);
      toast('Đã lưu sản phẩm');
      location.replace(backTo(payload.group_id));
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      btn.disabled = false;
    }
  };
  drawComps();
}
