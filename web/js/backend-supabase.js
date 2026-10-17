// Kết nối Supabase. Mọi nghiệp vụ đụng tới kho/tiền chạy bằng hàm SQL (rpc) để luôn khớp.
const ORDER_SELECT = '*, customer:customers(id,name,phone), items:order_items(id,product_id,name,price,qty)';
const TABLES = ['settings', 'staff', 'materials', 'products', 'product_components', 'customers',
  'orders', 'order_items', 'stock_moves', 'expenses'];

/** createClient, clientOptions: chỉ dùng cho kiểm thử (tests/supabase-it) để chạy với PostgREST trên máy. */
export async function createSupabaseBackend(url, key, { createClient, clientOptions = {} } = {}) {
  const create = createClient
    ?? (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm')).createClient;
  const sb = create(url, key, { auth: { persistSession: true, autoRefreshToken: true }, ...clientOptions });

  const run = async (q) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  };
  const rpc = (fn, args) => run(sb.rpc(fn, args));

  /** PostgREST trả tối đa 1000 dòng mỗi lần: đọc nhiều trang khi cần. */
  async function all(build) {
    const out = [];
    for (let fromRow = 0; ; fromRow += 1000) {
      const page = await run(build().range(fromRow, fromRow + 999));
      out.push(...page);
      if (page.length < 1000) return out;
    }
  }

  const withComponents = (p) => ({
    ...p,
    components: (p.components || []).map((c) => ({ material_id: c.material_id, qty: Number(c.qty) })),
  });

  return {
    mode: 'supabase',

    async getUser() {
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const staff = await run(sb.from('staff').select('name, role').eq('user_id', user.id).maybeSingle());
      return { id: user.id, email: user.email, name: staff?.name || user.email, role: staff?.role || null };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Sai email hoặc mật khẩu' : error.message);
    },
    async signOut() { await sb.auth.signOut(); },

    getSettings: () => run(sb.from('settings').select('*').eq('id', 1).single()),
    async saveSettings(patch) {
      const rows = await run(sb.from('settings').update(patch).eq('id', 1).select());
      if (!rows.length) throw new Error('Chỉ chủ shop mới sửa được cài đặt');
    },

    listMaterials: () => run(sb.from('materials').select('*').order('kind').order('name')),
    async saveMaterial(m) {
      const { id, ...fields } = m;
      try {
        if (id) await run(sb.from('materials').update(fields).eq('id', id));
        else await run(sb.from('materials').insert(fields));
      } catch (e) {
        if (/duplicate key/.test(e.message)) throw new Error('Tên này đã có trong kho');
        throw e;
      }
    },
    importStock: (id, qty, unitCost, note, date) =>
      rpc('import_stock', { p_material: id, p_qty: qty, p_unit_cost: unitCost, p_note: note || '', p_date: date }),
    wasteStock: (id, qty, note) => rpc('waste_stock', { p_material: id, p_qty: qty, p_note: note || '' }),
    adjustStock: (id, actual, note) => rpc('adjust_stock', { p_material: id, p_actual: actual, p_note: note || '' }),
    listStockMoves({ materialId, kind, from, to, limit = 200 } = {}) {
      let q = sb.from('stock_moves').select('*, material:materials(name,unit)').order('id', { ascending: false });
      if (materialId) q = q.eq('material_id', materialId);
      if (kind) q = q.eq('kind', kind);
      // Ngày theo giờ Việt Nam.
      if (from) q = q.gte('created_at', `${from}T00:00:00+07:00`);
      if (to) q = q.lte('created_at', `${to}T23:59:59.999+07:00`);
      return run(q.limit(Math.min(limit, 1000)));
    },

    publicCatalog: () => rpc('public_catalog'),

    async listProducts() {
      const rows = await run(sb.from('products').select('*, components:product_components(material_id,qty)')
        .order('active', { ascending: false }).order('name'));
      return rows.map(withComponents);
    },
    saveProduct: (p) => rpc('save_product', { p }),

    listCustomers: () => all(() => sb.from('customer_stats').select('*').order('total_spent', { ascending: false })),
    getCustomer: (id) => run(sb.from('customer_stats').select('*').eq('id', id).single()),
    async saveCustomer(c) {
      const { id, order_count, total_spent, debt, last_order_date, created_at, ...fields } = c;
      try {
        if (id) { await run(sb.from('customers').update(fields).eq('id', id)); return id; }
        const row = await run(sb.from('customers').insert(fields).select('id').single());
        return row.id;
      } catch (e) {
        if (/duplicate key/.test(e.message)) throw new Error('Số điện thoại này đã có khách khác');
        throw e;
      }
    },

    async listOrders({ from, to, statuses, unpaidOnly, customerId, limit = 500, newestFirst } = {}) {
      const build = () => {
        let q = sb.from('orders').select(ORDER_SELECT);
        if (from) q = q.gte('delivery_date', from);
        if (to) q = q.lte('delivery_date', to);
        if (statuses?.length) q = q.in('status', statuses);
        if (unpaidOnly) q = q.eq('paid', false).neq('status', 'huy');
        if (customerId) q = q.eq('customer_id', customerId);
        const asc = !newestFirst;
        return q.order('delivery_date', { ascending: asc }).order('delivery_slot', { ascending: asc }).order('id', { ascending: asc });
      };
      if (limit <= 1000) return run(build().limit(limit));
      return (await all(build)).slice(0, limit);
    },
    getOrder: (id) => run(sb.from('orders').select(ORDER_SELECT).eq('id', id).single()),
    createOrder: (payload) => rpc('create_order', { p: payload }),
    setOrderStatus: (id, status) => rpc('set_order_status', { p_order: id, p_status: status }),
    async updateOrder(id, patch) {
      const allowed = ['paid', 'payment_method', 'shipper', 'photo_url', 'note', 'card_message', 'delivery_slot', 'delivery_date', 'address'];
      const fields = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
      await run(sb.from('orders').update(fields).eq('id', id));
    },

    listExpenses({ from, to }) {
      return run(sb.from('expenses').select('*').gte('date', from).lte('date', to)
        .order('date', { ascending: false }).order('id', { ascending: false }));
    },
    addExpense: (e) => run(sb.from('expenses').insert(e)),
    deleteExpense: (id) => run(sb.from('expenses').delete().eq('id', id)),

    async uploadPhoto(blob, folder) {
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);
      return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
    },

    async exportAll() {
      const out = {};
      for (const t of TABLES) out[t] = await all(() => sb.from(t).select('*'));
      return out;
    },
  };
}
