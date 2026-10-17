// Sản phẩm (mẫu bó hoa) và công thức: giá vốn, lãi, giá ngày lễ.
import { app } from '../app.js';
import { html, raw, ICON, money, num, parseMoney, bindMoneyInputs, toast, errMsg, shrinkImage } from '../util.js';
import { productCost } from '../stats.js';

export async function list({ el }) {
  const { db } = app;
  const [products, materials] = await Promise.all([db.listProducts(), db.listMaterials()]);
  el.innerHTML = html`
    <header class="top-nav"><a class="back" href="#/them">${raw(ICON.back)}Thêm</a><h1>Sản phẩm</h1><a class="btn btn-sm btn-primary" href="#/san-pham/moi" style="margin-right: 8px">+ Thêm</a></header>
    <div class="page">
      <label class="search">${raw(ICON.search)}<input type="search" id="q" placeholder="Tìm sản phẩm…" aria-label="Tìm sản phẩm"></label>
      ${products.length ? html`<div class="list">
        ${products.map((p) => {
          const cost = productCost(p, materials);
          const margin = p.price ? (p.price - cost) / p.price : 0;
          return html`
            <a class="item" href="#/san-pham/${p.id}" data-name="${p.name.toLowerCase()}" style="${p.active ? '' : 'opacity: .55'}">
              ${p.photo_url ? html`<img class="thumb" src="${p.photo_url}" alt="">` : html`<div class="thumb"></div>`}
              <div class="grow">
                <div class="title">${p.name}${p.active ? '' : html` <span class="chip">Ngừng bán</span>`}</div>
                <div class="muted">${money(p.price)}${p.holiday_price != null ? ` · lễ ${money(p.holiday_price)}` : ''}</div>
                <div class="small ${margin < 0.3 ? 'neg' : 'pos'}">Vốn ${money(cost)} · lãi ${Math.round(margin * 100)}%</div>
              </div>
              <span class="chev">›</span>
            </a>`;
        })}
      </div>` : html`<div class="card empty">Chưa có sản phẩm nào.<br><a class="btn btn-outline" href="#/san-pham/moi">+ Thêm sản phẩm đầu tiên</a></div>`}
    </div>`.s;
  el.querySelector('#q').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    el.querySelectorAll('[data-name]').forEach((a) => a.classList.toggle('hidden', !a.dataset.name.includes(q)));
  });
}

export async function edit({ el, params }) {
  const { db } = app;
  const [products, materials] = await Promise.all([db.listProducts(), db.listMaterials()]);
  const isNew = params[0] === 'moi';
  const p = isNew
    ? { name: '', description: '', categories: [], price: 0, holiday_price: null, photo_url: null, active: true, components: [] }
    : products.find((x) => x.id === Number(params[0]));
  if (!p) throw new Error('Không tìm thấy sản phẩm');
  const st = { ...p, components: p.components.map((c) => ({ ...c })) };
  const usable = materials.filter((m) => m.active !== false || st.components.some((c) => c.material_id === m.id));
  const knownCats = [...new Set(products.flatMap((x) => x.categories || []))];

  el.innerHTML = html`
    <header class="top-nav">
      <a class="back" href="#/san-pham">${raw(ICON.back)}Sản phẩm</a><h1>${isNew ? 'Sản phẩm mới' : ''}</h1>
      <label class="check" style="margin-right: 8px; color: var(--green); font-weight: 600"><input type="checkbox" id="active" ${st.active ? 'checked' : ''} style="accent-color: var(--green)">Đang bán</label>
    </header>
    <form class="page" id="f" novalidate>
      <div class="row" style="justify-content: flex-start; gap: 12px">
        <label class="photo-drop" style="width: 104px; height: 104px; min-height: 0; flex-shrink: 0; padding: 0" aria-label="Ảnh sản phẩm">
          <span id="photo-box">${st.photo_url ? html`<img src="${st.photo_url}" alt="" style="width: 104px; height: 104px; object-fit: cover">` : html`${raw(ICON.camera)}<span class="small">Thêm ảnh</span>`}</span>
          <input type="file" accept="image/*" id="photo">
        </label>
        <div class="grow stack">
          <label class="field">Tên sản phẩm<input name="name" value="${st.name}" placeholder="VD: Bó hồng đỏ 20 bông"></label>
        </div>
      </div>
      <label class="field">Danh mục (cách nhau bởi dấu phẩy)<input name="cats" list="cats" value="${st.categories.join(', ')}" placeholder="Sinh nhật, Tình yêu"></label>
      <datalist id="cats">${knownCats.map((c) => html`<option value="${c}"></option>`)}</datalist>
      <label class="field">Mô tả cho khách (hiện trên trang cửa hàng)<textarea name="description" rows="2" placeholder="VD: 20 hồng đỏ Đà Lạt, điểm baby trắng, gói giấy kraft.">${st.description || ''}</textarea></label>

      <section class="card stack">
        <div class="row"><h2 style="margin: 0">Công thức bó hoa</h2><span class="muted">tự trừ kho khi cắm</span></div>
        <div id="comps" class="stack"></div>
        <button type="button" class="btn btn-dashed" id="add-comp" ${usable.length ? '' : 'disabled'}>+ Thêm hoa / phụ liệu</button>
        ${usable.length ? '' : html`<div class="muted">Thêm hoa vào <a href="#/kho">Kho</a> trước để lập công thức.</div>`}
      </section>

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
      st.photo_url = await db.uploadPhoto(await shrinkImage(file, db.mode === 'demo' ? 480 : 1000), 'products');
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
      location.replace('#/san-pham');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      btn.disabled = false;
    }
  };
  drawComps();
}
