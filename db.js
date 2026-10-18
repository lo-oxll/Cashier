/* طبقة البيانات المحلية: تحاكي مسارات API الخادم السابق لكن داخل المتصفح (IndexedDB) */
(function (root) {
'use strict';
const PERMS = ['pos', 'discount', 'return', 'products', 'products_edit', 'cost', 'stock', 'reports', 'expenses', 'customers', 'users', 'settings'];
const ROLES = {
  'مدير عام': PERMS,
  'مدير': PERMS.filter(p => p !== 'users' && p !== 'settings'),
  'كاشير': ['pos', 'customers'],
  'أمين مخزن': ['products', 'products_edit', 'stock']
};
const DEF = { shop_name: 'متجر الملابس', shop_phone: '', shop_address: '', receipt_footer: 'شكراً لزيارتكم', currency: 'د.ع', paper_mm: '80', label_w: '50', label_h: '30', label_name: '1', label_price: '1', allow_negative: '1', auto_print: '1', low_stock: '2' };
const TABLES = ['roles', 'users', 'categories', 'products', 'variants', 'customers', 'sales', 'sale_items', 'stock_moves', 'expenses', 'debt_payments', 'settings'];

class HttpError extends Error { constructor(m, code) { super(m); this.code = code || 400; } }
const bad = (m, c) => { throw new HttpError(m, c); };
const J = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, '0');
const now = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const today = () => now().slice(0, 10);
function num(x) {
  if (x === null || x === undefined || x === '') return 0;
  const n = Math.round(parseFloat(String(x).replace(/,/g, '').trim()));
  if (!isFinite(n)) bad('رقم غير صالح');
  return n;
}

/* ---------- التخزين الدائم ---------- */
function memBackend() {
  const st = {};
  return {
    async load() { const o = {}; for (const k in st) o[k] = Object.values(st[k]).map(J); return o; },
    async write(ops) { for (const o of ops) { const s = st[o.t] || (st[o.t] = {}); if (o.op === 'put') s[o.row.id] = J(o.row); else delete s[o.id]; } },
    async clear() { for (const k in st) delete st[k]; }
  };
}
function idbBackend() {
  let db;
  const open = () => db ? Promise.resolve(db) : new Promise((res, rej) => {
    const r = indexedDB.open('pos-clothing', 1);
    r.onupgradeneeded = () => { for (const t of [...TABLES, 'meta']) r.result.createObjectStore(t, { keyPath: 'id' }); };
    r.onsuccess = () => { db = r.result; res(db); };
    r.onerror = () => rej(r.error);
  });
  const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
  return {
    async load() {
      const d = await open(), o = {};
      await Promise.all([...TABLES, 'meta'].map(t => new Promise((res, rej) => { const q = d.transaction(t).objectStore(t).getAll(); q.onsuccess = () => { o[t] = q.result; res(); }; q.onerror = () => rej(q.error); })));
      return o;
    },
    async write(ops) {
      const d = await open(), names = [...new Set(ops.map(o => o.t))];
      if (!names.length) return;
      const tx = d.transaction(names, 'readwrite');
      for (const o of ops) { const s = tx.objectStore(o.t); o.op === 'put' ? s.put(o.row) : s.delete(o.id); }
      await done(tx);
    },
    async clear() {
      const d = await open(), tx = d.transaction([...TABLES, 'meta'], 'readwrite');
      for (const t of [...TABLES, 'meta']) tx.objectStore(t).clear();
      await done(tx);
    }
  };
}

/* ---------- الذاكرة + سجل التراجع ---------- */
let backend, M = {}, SEQ = {}, log = [], dirty = new Map(), seqDirty = false;
let chain = Promise.resolve();   // يسلسل العمليات لتبقى ذرّية

const T = t => M[t];
function put(t, row) {
  const old = M[t].get(row.id);
  log.push({ t, id: row.id, old: old && J(old) });
  M[t].set(row.id, row);
  dirty.set(t + ':' + row.id, { t, op: 'put', row });
  return row;
}
function del(t, id) {
  log.push({ t, id, old: M[t].get(id) && J(M[t].get(id)) });
  M[t].delete(id);
  dirty.set(t + ':' + id, { t, op: 'del', id });
}
function ins(t, row) { SEQ[t] = (SEQ[t] || 0) + 1; seqDirty = true; row.id = SEQ[t]; return put(t, row); }
function rollbackTo(mark) {
  while (log.length > mark) {
    const e = log.pop();
    if (e.old) { M[e.t].set(e.id, e.old); dirty.set(e.t + ':' + e.id, { t: e.t, op: 'put', row: e.old }); }
    else { M[e.t].delete(e.id); dirty.set(e.t + ':' + e.id, { t: e.t, op: 'del', id: e.id }); }
  }
}
const setting = (k, v) => put('settings', { id: k, v: String(v) });
const cfg = () => { const r = { ...DEF }; for (const s of M.settings.values()) if (s.id in DEF) r[s.id] = s.v; return r; };

async function flush() {
  const ops = [...dirty.values()];
  if (seqDirty) ops.push({ t: 'meta', op: 'put', row: { id: 'seq', ...SEQ } });
  dirty = new Map(); seqDirty = false; log = [];
  if (ops.length) await backend.write(ops);
}
function tx(fn) {   // عملية كتابة ذرّية
  const run = chain.then(async () => {
    const seq0 = { ...SEQ };
    log = [];
    try { const r = await fn(); await flush(); return r; }
    catch (e) { rollbackTo(0); SEQ = seq0; seqDirty = false; dirty = new Map(); throw e; }
  });
  chain = run.catch(() => { });
  return run;
}
const read = fn => chain.then(fn);

/* ---------- كلمات المرور (PBKDF2) ---------- */
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function hashPw(pw, salt) {
  salt = salt || hex(crypto.getRandomValues(new Uint8Array(16)));
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 120000 }, k, 256);
  return 'p1$' + salt + '$' + hex(b);
}
async function checkPw(pw, stored) { const [, salt] = String(stored).split('$'); return (await hashPw(pw, salt)) === stored; }

/* ---------- الجلسة ---------- */
let memSession = null;
const SK = 'pos_session';
function getSession() {
  try { const s = JSON.parse(localStorage.getItem(SK) || 'null'); if (s && s.exp > Date.now()) return s.uid; } catch (e) { }
  return memSession;
}
function setSession(uid) {
  memSession = uid;
  try { uid ? localStorage.setItem(SK, JSON.stringify({ uid, exp: Date.now() + 14 * 864e5 })) : localStorage.removeItem(SK); } catch (e) { }
}
let CU = null;
function curUser() {
  const uid = getSession();
  if (!uid) return null;
  const u = M.users.get(uid);
  if (!u || !u.active) return null;
  const r = M.roles.get(u.role_id);
  return { id: u.id, username: u.username, name: u.name, role_id: u.role_id, role: r.name, perms: u.role_id === 1 ? PERMS : r.perms.filter(p => PERMS.includes(p)) };
}
const can = p => !!CU && CU.perms.includes(p);

/* ---------- أدوات ---------- */
const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
const all = t => [...M[t].values()];
const lc = s => String(s ?? '').toLowerCase();
const has = (s, t) => lc(s).includes(t);
function catId(name) {
  name = (name || '').trim();
  if (!name) return null;
  const c = all('categories').find(x => x.name === name);
  return c ? c.id : ins('categories', { name }).id;
}
function genBarcodes(n) {
  let s = M.settings.get('barcode_seq') ? +M.settings.get('barcode_seq').v : 0; const out = [];
  const used = new Set(all('variants').map(v => v.barcode));
  while (out.length < n) { s++; const b = '20' + String(s).padStart(8, '0'); if (!used.has(b)) out.push(b); }
  setting('barcode_seq', s);
  return out;
}
function move(vid, delta, type, ref = '') {
  const v = M.variants.get(vid);
  put('variants', { ...v, qty: v.qty + delta });
  ins('stock_moves', { variant_id: vid, qty: delta, type, ref, user_id: CU ? CU.id : null, created_at: now() });
}
function barcodeTaken(bc, exceptId) { return all('variants').some(v => v.barcode === bc && v.id !== exceptId); }

function cleanP(d) {
  const name = (d.name || '').trim();
  if (!name) bad('اسم المنتج مطلوب');
  const price = num(d.price), cost = num(d.cost);
  if (price < 0 || cost < 0) bad('سعر غير صالح');
  return [name, (d.brand || '').trim(), cost, price];
}
function saveVariants(pid, vs) {
  for (const v of vs) {
    const size = (v.size || '').trim(), color = (v.color || '').trim(), qty = num(v.qty);
    if (v.id) {
      const old = M.variants.get(v.id);
      if (!old || old.product_id !== pid) bad('صنف غير موجود');
      put('variants', { ...old, size, color });
      const delta = qty - (v.qty0 !== undefined && v.qty0 !== null ? num(v.qty0) : old.qty);
      if (delta) move(v.id, delta, 'adjust', 'تعديل من شاشة المنتج');
    } else {
      const bc = (v.barcode || '').trim() || genBarcodes(1)[0];
      if (barcodeTaken(bc)) bad('باركود مكرر', 409);
      const nv = ins('variants', { product_id: pid, size, color, barcode: bc, qty: 0, active: 1 });
      if (qty) move(nv.id, qty, 'initial');
    }
  }
}
function productFull(pid) {
  const p = M.products.get(pid);
  if (!p) return null;
  const o = { ...p, category: p.category_id ? M.categories.get(p.category_id).name : null };
  o.variants = all('variants').filter(v => v.product_id === pid && v.active).sort((a, b) => a.id - b.id).map(v => ({ id: v.id, size: v.size, color: v.color, barcode: v.barcode, qty: v.qty }));
  if (!can('cost')) delete o.cost;
  return J(o);
}
const vrow = v => { const p = M.products.get(v.product_id); return { id: v.id, product_id: v.product_id, size: v.size, color: v.color, barcode: v.barcode, qty: v.qty, name: p.name, brand: p.brand, price: p.price, cost: p.cost }; };
const activeV = () => all('variants').filter(v => v.active && M.products.get(v.product_id).active);

function saleFull(sid) {
  const s = M.sales.get(sid);
  if (!s) return null;
  const o = { ...s, cashier: s.user_id && M.users.get(s.user_id) ? M.users.get(s.user_id).name : null, customer: s.customer_id ? M.customers.get(s.customer_id).name : null };
  const items = all('sale_items');
  o.items = items.filter(i => i.sale_id === sid).sort((a, b) => a.id - b.id).map(i => ({ ...i, returned: -sum(items.filter(r => r.ref_item_id === i.id), r => r.qty) }));
  if (!can('cost')) { delete o.cost_total; o.items.forEach(i => delete i.cost); }
  return J(o);
}

/* ---------- المسارات ---------- */
const R = [];
const route = (method, path, perms, fn) => R.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), perms, fn });

function sessionPayload() { return { user: J(CU), settings: cfg() }; }

const FAIL = {};
route('GET', '/status', null, () => ({ setup: M.users.size === 0, shop_name: cfg().shop_name }));
route('POST', '/setup', null, async ({ body }) => {
  if (M.users.size) bad('تم الإعداد مسبقاً', 409);
  const pw = body.password || '';
  if (pw.length < 6) bad('كلمة المرور 6 أحرف على الأقل');
  const h = await hashPw(pw);
  return tx(async () => {
    if (body.shop_name && body.shop_name.trim()) setting('shop_name', body.shop_name.trim());
    ins('users', { username: 'admin', name: (body.name || '').trim() || 'المدير', pw: h, role_id: 1, active: 1, created_at: now() });
    setSession(1); CU = curUser();
    return sessionPayload();
  });
});
route('POST', '/login', null, async ({ body }) => {
  const t = Date.now(), key = 'ip';
  FAIL[key] = (FAIL[key] || []).filter(x => t - x < 600000);
  if (FAIL[key].length >= 8) bad('محاولات كثيرة، انتظر بضع دقائق', 429);
  const un = (body.username || '').trim().toLowerCase();
  const u = all('users').find(x => x.username === un && x.active);
  if (!u || !(await checkPw(body.password || '', u.pw))) { FAIL[key].push(t); bad('اسم المستخدم أو كلمة المرور غير صحيحة', 401); }
  delete FAIL[key];
  setSession(u.id); CU = curUser();
  return sessionPayload();
});
route('POST', '/logout', null, () => { setSession(null); CU = null; return { ok: 1 }; });
route('GET', '/me', [], () => sessionPayload());
route('POST', '/password', [], async ({ body }) => {
  const u = M.users.get(CU.id);
  if (!(await checkPw(body.old || '', u.pw))) bad('كلمة المرور الحالية غير صحيحة');
  if ((body.new || '').length < 6) bad('كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)');
  const h = await hashPw(body.new);
  return tx(() => { put('users', { ...M.users.get(CU.id), pw: h }); return { ok: 1 }; });
});

route('PUT', '/settings', ['settings'], ({ body }) => tx(() => { for (const k in body) if (k in DEF) setting(k, String(body[k]).trim()); return { settings: cfg() }; }));

/* نسخ احتياطي / استرجاع */
route('GET', '/backup', ['settings'], () => {
  const d = { app: 'pos-clothing', version: 2, exported_at: now(), seq: { ...SEQ }, tables: {} };
  for (const t of TABLES) d.tables[t] = J(all(t));
  return d;
});
route('POST', '/restore', null, ({ body }) => tx(async () => {
  if (M.users.size && !can('settings')) bad('لا تملك صلاحية لهذا الإجراء', 403);   // على قاعدة فارغة يسمح بالاسترجاع بلا تسجيل دخول
  if (!body || body.app !== 'pos-clothing' || !body.tables) bad('ملف النسخة الاحتياطية غير صالح');
  await backend.clear();
  for (const t of TABLES) { M[t] = new Map((body.tables[t] || []).map(r => [r.id, r])); }
  SEQ = { ...(body.seq || {}) };
  for (const t of TABLES) for (const r of M[t].values()) if (typeof r.id === 'number' && r.id > (SEQ[t] || 0)) SEQ[t] = r.id;
  for (const t of TABLES) for (const r of M[t].values()) dirty.set(t + ':' + r.id, { t, op: 'put', row: r });
  seqDirty = true;
  setSession(null); CU = null;
  return { ok: 1 };
}));
route('POST', '/wipe', ['settings'], () => tx(async () => {
  await backend.clear();
  for (const t of TABLES) M[t] = new Map();
  SEQ = {}; log = []; dirty = new Map(); seedRoles();
  setSession(null); CU = null; seqDirty = true;
  return { ok: 1 };
}));

/* الكتالوج */
route('GET', '/categories', [], () => all('categories').map(c => c.name).sort((a, b) => a.localeCompare(b, 'ar')));
route('POST', '/products', ['products_edit'], ({ body: d }) => tx(() => {
  let [name, brand, cost, price] = cleanP(d);
  if (!can('cost')) cost = 0;
  const p = ins('products', { name, category_id: catId(d.category), brand, cost, price, active: 1, created_at: now() });
  saveVariants(p.id, d.variants && d.variants.length ? d.variants : [{}]);
  return [productFull(p.id), 201];
}));
route('PUT', '/products/:id', ['products_edit'], ({ p, body: d }) => tx(() => {
  const pid = +p.id, [name, brand, cost, price] = cleanP(d), old = M.products.get(pid);
  if (!old || !old.active) bad('المنتج غير موجود');
  put('products', { ...old, name, brand, price, category_id: catId(d.category) });
  if (can('cost') && d.cost !== undefined && d.cost !== null) put('products', { ...M.products.get(pid), cost });
  for (const vid of d.delete || []) { const v = M.variants.get(vid); if (v && v.product_id === pid) put('variants', { ...v, active: 0 }); }
  saveVariants(pid, d.variants || []);
  return productFull(pid);
}));
route('DELETE', '/products/:id', ['products_edit'], ({ p }) => tx(() => { const o = M.products.get(+p.id); if (o) put('products', { ...o, active: 0 }); return { ok: 1 }; }));
route('GET', '/products/:id', ['products', 'products_edit'], ({ p }) => { const r = productFull(+p.id); if (!r || !r.active) bad('غير موجود', 404); return r; });
route('GET', '/products', ['products'], ({ query: a }) => {
  const toks = (a.q || '').split(/\s+/).filter(Boolean).slice(0, 5).map(lc);
  const vs = all('variants').filter(v => v.active), low = num(cfg().low_stock);
  let rows = all('products').filter(p => p.active).filter(p => {
    const mv = vs.filter(v => v.product_id === p.id);
    if (!toks.every(t => has(p.name, t) || has(p.brand, t) || mv.some(v => has(v.barcode, t) || has(v.color, t)))) return false;
    if (a.category && (!p.category_id || M.categories.get(p.category_id).name !== a.category)) return false;
    if (a.low && !mv.some(v => v.qty <= low)) return false;
    return true;
  }).sort((x, y) => y.id - x.id).slice(num(a.page) * 40, num(a.page) * 40 + 40).map(p => {
    const mv = vs.filter(v => v.product_id === p.id);
    const o = { id: p.id, name: p.name, brand: p.brand, price: p.price, cost: p.cost, category: p.category_id ? M.categories.get(p.category_id).name : null, nv: mv.length, qty: sum(mv, v => v.qty) };
    if (!can('cost')) delete o.cost;
    return o;
  });
  return J(rows);
});
route('GET', '/export/products', ['products'], () => J(activeV().sort((a, b) => a.product_id - b.product_id || a.id - b.id).map(v => {
  const p = M.products.get(v.product_id);
  const o = { name: p.name, category: p.category_id ? M.categories.get(p.category_id).name : '', brand: p.brand, cost: p.cost, price: p.price, size: v.size, color: v.color, qty: v.qty, barcode: v.barcode };
  if (!can('cost')) delete o.cost;
  return o;
})));
route('GET', '/variants', ['pos', 'products', 'stock'], ({ query: a }) => {
  const s = (a.q || '').trim(), lim = Math.min(Math.max(num(a.limit || 30), 1), 200);
  let rows;
  if (a.recent) rows = activeV().sort((x, y) => y.id - x.id).slice(0, lim);
  else {
    rows = s ? activeV().filter(v => v.barcode === s) : [];
    if (!rows.length) {
      const toks = s.split(/\s+/).filter(Boolean).slice(0, 5).map(lc);
      rows = activeV().filter(v => { const p = M.products.get(v.product_id); return toks.every(t => has(p.name, t) || has(p.brand, t) || has(v.barcode, t) || has(v.size, t) || has(v.color, t)); })
        .sort((x, y) => M.products.get(x.product_id).name.localeCompare(M.products.get(y.product_id).name, 'ar') || String(x.size).localeCompare(String(y.size))).slice(0, lim);
    }
  }
  rows = rows.map(vrow);
  if (!can('cost')) rows.forEach(r => delete r.cost);
  return rows;
});

/* الاستيراد */
function importRow(r) {
  const name = (r.name || '').trim();
  if (!name) bad('اسم المنتج مطلوب');
  const price = num(r.price), cost = num(r.cost), qty = num(r.qty);
  if (price < 0 || cost < 0) bad('سعر غير صالح');
  const brand = (r.brand || '').trim(), size = (r.size || '').trim(), color = (r.color || '').trim(), bc = String(r.barcode || '').trim(), keep = can('cost');
  let v = bc ? all('variants').find(x => x.barcode === bc) : null, pid;
  if (v) pid = v.product_id;
  else {
    let p = all('products').find(x => x.name === name && x.brand === brand && x.active);
    pid = p ? p.id : ins('products', { name, category_id: catId(r.category), brand, cost: keep ? cost : 0, price, active: 1, created_at: now() }).id;
    v = all('variants').find(x => x.product_id === pid && x.size === size && x.color === color && x.active);
  }
  put('products', { ...M.products.get(pid), price });
  if (keep && cost) put('products', { ...M.products.get(pid), cost });
  if (r.category) put('products', { ...M.products.get(pid), category_id: catId(r.category) });
  if (v) {
    put('variants', { ...M.variants.get(v.id), size, color });
    const cur = M.variants.get(v.id).qty;
    if (qty !== cur) move(v.id, qty - cur, 'import');
    return 'updated';
  }
  const nb = bc || genBarcodes(1)[0];
  if (barcodeTaken(nb)) bad('باركود مكرر');
  const nv = ins('variants', { product_id: pid, size, color, barcode: nb, qty: 0, active: 1 });
  if (qty) move(nv.id, qty, 'import');
  return 'created';
}
route('POST', '/import', ['products_edit'], ({ body }) => tx(() => {
  const res = { created: 0, updated: 0, errors: [] };
  (body.rows || []).slice(0, 1000).forEach((r, i) => {
    const mark = log.length, s0 = { ...SEQ };
    try { res[importRow(r)]++; }
    catch (e) { if (!(e instanceof HttpError)) throw e; rollbackTo(mark); SEQ = s0; res.errors.push({ row: r._n || i + 1, error: e.message }); }
  });
  return res;
}));

/* المخزون */
route('POST', '/stock', ['stock'], ({ body: d }) => tx(() => {
  const qty = num(d.qty), v = M.variants.get(+d.variant_id);
  if (!v || !v.active) bad('صنف غير موجود');
  const delta = d.mode === 'set' ? qty - v.qty : qty;
  if (delta) move(v.id, delta, d.mode === 'set' ? 'adjust' : 'add', (d.note || '').trim().slice(0, 120));
  return { qty: M.variants.get(v.id).qty };
}));
route('GET', '/stock/moves', ['stock'], () => J(all('stock_moves').sort((a, b) => b.id - a.id).slice(0, 60).map(m => {
  const v = M.variants.get(m.variant_id), p = M.products.get(v.product_id), u = m.user_id && M.users.get(m.user_id);
  return { id: m.id, qty: m.qty, type: m.type, ref: m.ref, created_at: m.created_at, name: p.name, size: v.size, color: v.color, user: u ? u.name : null };
})));

/* المبيعات */
route('POST', '/sales', ['pos'], ({ body: d }) => tx(() => {
  const perms = CU.perms, items = d.items || [];
  if (!items.length) bad('السلة فارغة');
  const method = d.method || 'cash';
  if (!['cash', 'card', 'credit'].includes(method)) bad('طريقة دفع غير صالحة');
  const allowNeg = cfg().allow_negative === '1', lines = [], needQ = {};
  let sub = 0, cost = 0;
  for (const it of items) {
    const qty = num(it.qty);
    if (qty <= 0) bad('كمية غير صالحة');
    const v = M.variants.get(+it.variant_id);
    if (!v || !v.active || !M.products.get(v.product_id).active) bad('صنف غير موجود أو محذوف');
    const vr = vrow(v);
    const price = perms.includes('discount') && it.price !== undefined && it.price !== null ? num(it.price) : vr.price;
    if (price < 0) bad('سعر غير صالح');
    needQ[v.id] = (needQ[v.id] || 0) + qty;
    if (!allowNeg && v.qty < needQ[v.id]) bad(`الكمية غير كافية: ${vr.name} (المتوفر ${v.qty})`);
    sub += price * qty; cost += vr.cost * qty; lines.push([vr, qty, price]);
  }
  const disc = perms.includes('discount') ? Math.min(Math.max(num(d.discount), 0), sub) : 0, total = sub - disc, cid = d.customer_id || null;
  let paid = total;
  if (method === 'credit') {
    if (!cid || !M.customers.get(+cid)) bad('اختر الزبون للبيع بالآجل');
    paid = Math.min(Math.max(num(d.paid), 0), total);
  }
  const s = ins('sales', { type: 'sale', ref_id: null, user_id: CU.id, customer_id: cid ? +cid : null, subtotal: sub, discount: disc, total, paid, method, cost_total: cost, created_at: now() });
  for (const [v, qty, price] of lines) {
    ins('sale_items', { sale_id: s.id, variant_id: v.id, ref_item_id: null, name: v.name, size: v.size, color: v.color, qty, price, cost: v.cost, line_total: price * qty });
    move(v.id, -qty, 'sale', String(s.id));
  }
  if (cid && total - paid) put('customers', { ...M.customers.get(+cid), balance: M.customers.get(+cid).balance + total - paid });
  return [{ sale: saleFull(s.id) }, 201];
}));
route('POST', '/sales/:id/return', ['return'], ({ p, body: d }) => tx(() => {
  const sid = +p.id, o = M.sales.get(sid);
  if (!o || o.type !== 'sale') bad('الفاتورة غير موجودة');
  const ratio = o.subtotal ? o.total / o.subtotal : 0, lines = [], items = all('sale_items');
  let sub = 0, cost = 0;
  for (const it of d.items || []) {
    const qty = num(it.qty);
    if (qty <= 0) continue;
    const si = M.sale_items.get(+it.id);
    if (!si || si.sale_id !== sid) bad('كمية الإرجاع أكبر من المتاح');
    const ret = -sum(items.filter(r => r.ref_item_id === si.id), r => r.qty);
    if (qty > si.qty - ret) bad('كمية الإرجاع أكبر من المتاح');
    const lt = Math.round(si.price * qty * ratio);
    sub += lt; cost += si.cost * qty; lines.push([si, qty, lt]);
  }
  if (!lines.length) bad('اختر أصنافاً للإرجاع');
  const r = ins('sales', { type: 'return', ref_id: sid, user_id: CU.id, customer_id: o.customer_id, subtotal: -sub, discount: 0, total: -sub, paid: -sub, method: o.method, cost_total: -cost, created_at: now() });
  for (const [si, qty, lt] of lines) {
    ins('sale_items', { sale_id: r.id, variant_id: si.variant_id, ref_item_id: si.id, name: si.name, size: si.size, color: si.color, qty: -qty, price: si.price, cost: si.cost, line_total: -lt });
    move(si.variant_id, qty, 'return', String(r.id));
  }
  if (o.customer_id && o.method === 'credit') {
    const c = M.customers.get(o.customer_id);
    put('customers', { ...c, balance: c.balance - Math.min(sub, Math.max(c.balance, 0)) });
  }
  return [{ sale: saleFull(r.id) }, 201];
}));
route('GET', '/sales/:id', ['pos', 'reports'], ({ p }) => {
  const s = saleFull(+p.id);
  if (!s || (!can('reports') && s.user_id !== CU.id)) bad('غير موجود', 404);
  return s;
});
route('GET', '/sales', ['pos', 'reports'], ({ query: a }) => {
  const f = a.from || today(), t = a.to || f, lo = f + ' 00:00:00', hi = t + ' 23:59:59', qn = (a.q || '').trim();
  return J(all('sales').filter(s => s.created_at >= lo && s.created_at <= hi && (can('reports') || s.user_id === CU.id) && (!/^\d+$/.test(qn) || s.id === +qn))
    .sort((x, y) => y.id - x.id).slice(0, 200).map(s => ({ id: s.id, type: s.type, total: s.total, method: s.method, created_at: s.created_at, cashier: s.user_id && M.users.get(s.user_id) ? M.users.get(s.user_id).name : null, customer: s.customer_id ? M.customers.get(s.customer_id).name : null })));
});

/* الزبائن */
route('GET', '/customers', ['customers', 'pos'], ({ query: a }) => {
  const s = lc((a.q || '').trim());
  return J(all('customers').filter(c => has(c.name, s) || has(c.phone, s)).sort((x, y) => x.name.localeCompare(y.name, 'ar')).slice(0, 50));
});
route('POST', '/customers', ['customers', 'pos'], ({ body: d }) => tx(() => {
  const name = (d.name || '').trim();
  if (!name) bad('الاسم مطلوب');
  return [J(ins('customers', { name, phone: (d.phone || '').trim(), balance: 0 })), 201];
}));
route('PUT', '/customers/:id', ['customers'], ({ p, body: d }) => tx(() => {
  const name = (d.name || '').trim(), c = M.customers.get(+p.id);
  if (!name) bad('الاسم مطلوب');
  if (!c) bad('غير موجود', 404);
  return J(put('customers', { ...c, name, phone: (d.phone || '').trim() }));
}));
route('POST', '/customers/:id/pay', ['customers'], ({ p, body: d }) => tx(() => {
  const amt = num(d.amount), c = M.customers.get(+p.id);
  if (amt <= 0) bad('المبلغ غير صالح');
  if (!c) bad('غير موجود', 404);
  put('customers', { ...c, balance: c.balance - amt });
  ins('debt_payments', { customer_id: c.id, amount: amt, user_id: CU.id, created_at: now() });
  return J(M.customers.get(c.id));
}));

/* المصاريف */
route('GET', '/expenses', ['expenses'], ({ query: a }) => {
  const f = a.from || today().slice(0, 8) + '01', t = a.to || today(), lo = f + ' 00:00:00', hi = t + ' 23:59:59';
  const rows = all('expenses').filter(e => e.created_at >= lo && e.created_at <= hi).sort((x, y) => y.id - x.id).map(e => ({ id: e.id, title: e.title, amount: e.amount, created_at: e.created_at, user: e.user_id && M.users.get(e.user_id) ? M.users.get(e.user_id).name : null }));
  return { rows, total: sum(rows, r => r.amount) };
});
route('POST', '/expenses', ['expenses'], ({ body: d }) => tx(() => {
  const title = (d.title || '').trim(), amt = num(d.amount);
  if (!title || amt <= 0) bad('العنوان والمبلغ مطلوبان');
  ins('expenses', { title, amount: amt, user_id: CU.id, created_at: now() });
  return [{ ok: 1 }, 201];
}));
route('DELETE', '/expenses/:id', ['expenses'], ({ p }) => tx(() => { del('expenses', +p.id); return { ok: 1 }; }));

/* التقارير */
function periodKey(g, ts) {
  if (g === 'week') {
    const d = new Date(ts.slice(0, 10) + 'T00:00:00'), y0 = new Date(d.getFullYear(), 0, 1);
    const yday = Math.round((d - y0) / 864e5), wd = (d.getDay() + 6) % 7;
    return d.getFullYear() + '-W' + pad(Math.floor((yday + 7 - wd) / 7));
  }
  return ts.slice(0, { day: 10, month: 7, year: 4 }[g] || 10);
}
route('GET', '/reports', ['reports'], ({ query: a }) => {
  const f = a.from || today(), t = a.to || f, lo = f + ' 00:00:00', hi = t + ' 23:59:59', grp = ['day', 'week', 'month', 'year'].includes(a.group) ? a.group : 'day', cost = can('cost');
  const inr = x => x.created_at >= lo && x.created_at <= hi;
  const sales = all('sales').filter(inr), g = new Map();
  for (const s of sales) {
    const k = periodKey(grp, s.created_at);
    const r = g.get(k) || { p: k, n: 0, sales: 0, returns: 0, net: 0, cost: 0 };
    if (s.type === 'sale') { r.n++; r.sales += s.total; } else r.returns += -s.total;
    r.net += s.total; r.cost += s.cost_total; g.set(k, r);
  }
  const rows = [...g.values()].sort((x, y) => x.p < y.p ? -1 : 1);
  rows.forEach(r => { if (cost) r.profit = r.net - r.cost; delete r.cost; });
  const out = { rows, n: sum(rows, r => r.n), sales: sum(rows, r => r.sales), returns: sum(rows, r => r.returns), net: sum(rows, r => r.net) };
  if (cost) out.profit = sum(rows, r => r.profit);
  out.expenses = sum(all('expenses').filter(inr), e => e.amount);
  out.debt_paid = sum(all('debt_payments').filter(inr), e => e.amount);
  const ids = new Set(sales.map(s => s.id)), tp = new Map();
  for (const i of all('sale_items')) if (ids.has(i.sale_id)) { const r = tp.get(i.name) || { name: i.name, qty: 0, total: 0 }; r.qty += i.qty; r.total += i.line_total; tp.set(i.name, r); }
  out.top = [...tp.values()].sort((x, y) => y.total - x.total).slice(0, 15);
  const cs = new Map();
  for (const s of sales) { if (!s.user_id) continue; const r = cs.get(s.user_id) || { name: M.users.get(s.user_id).name, n: 0, total: 0 }; if (s.type === 'sale') r.n++; r.total += s.total; cs.set(s.user_id, r); }
  out.cashiers = [...cs.values()].sort((x, y) => y.total - x.total);
  const ms = new Map();
  for (const s of sales) { const r = ms.get(s.method) || { method: s.method, n: 0, total: 0 }; if (s.type === 'sale') r.n++; r.total += s.total; ms.set(s.method, r); }
  out.methods = [...ms.values()];
  const lowN = num(cfg().low_stock);
  out.low = activeV().filter(v => v.qty <= lowN).sort((x, y) => x.qty - y.qty || M.products.get(x.product_id).name.localeCompare(M.products.get(y.product_id).name, 'ar')).slice(0, 30).map(v => ({ name: M.products.get(v.product_id).name, size: v.size, color: v.color, barcode: v.barcode, qty: v.qty }));
  const inv = { pieces: 0, cost_value: 0, retail_value: 0 };
  for (const v of activeV()) if (v.qty > 0) { const p = M.products.get(v.product_id); inv.pieces += v.qty; inv.cost_value += v.qty * p.cost; inv.retail_value += v.qty * p.price; }
  if (!cost) delete inv.cost_value;
  out.inventory = inv;
  return J(out);
});

/* المستخدمون والأدوار */
const roleOk = id => { if (!M.roles.get(+id)) bad('الدور غير موجود'); };
route('GET', '/users', ['users'], () => J(all('users').sort((a, b) => a.id - b.id).map(u => ({ id: u.id, username: u.username, name: u.name, role_id: u.role_id, role: M.roles.get(u.role_id).name, active: u.active }))));
route('POST', '/users', ['users'], async ({ body: d }) => {
  const un = (d.username || '').trim().toLowerCase(), name = (d.name || '').trim();
  if (!un || !name || (d.password || '').length < 6) bad('الاسم واسم المستخدم مطلوبان وكلمة المرور 6 أحرف على الأقل');
  const h = await hashPw(d.password);
  return tx(() => {
    roleOk(d.role_id);
    if (all('users').some(u => u.username === un)) bad('قيمة مكررة أو بيانات غير صالحة (مثل باركود أو اسم مستخدم مكرر)', 409);
    ins('users', { username: un, name, pw: h, role_id: +d.role_id, active: 1, created_at: now() });
    return [{ ok: 1 }, 201];
  });
});
route('PUT', '/users/:id', ['users'], async ({ p, body: d }) => {
  const uid = +p.id, name = (d.name || '').trim();
  if (!name) bad('الاسم مطلوب');
  let role = d.role_id, active = d.active === undefined || d.active ? 1 : 0;
  if (uid === 1) { role = 1; active = 1; }
  if (uid === CU.id) active = 1;
  if (d.password && d.password.length < 6) bad('كلمة المرور 6 أحرف على الأقل');
  const h = d.password ? await hashPw(d.password) : null;
  return tx(() => {
    roleOk(role);
    const u = M.users.get(uid);
    if (!u) bad('غير موجود', 404);
    put('users', { ...u, name, role_id: +role, active, ...(h ? { pw: h } : {}) });
    return { ok: 1 };
  });
});
route('GET', '/roles', ['users'], () => J(all('roles').sort((a, b) => a.id - b.id).map(r => ({ ...r, perms: r.id === 1 ? PERMS : r.perms }))));
route('POST', '/roles', ['users'], ({ body: d }) => tx(() => {
  const name = (d.name || '').trim();
  if (!name) bad('اسم الدور مطلوب');
  if (all('roles').some(r => r.name === name)) bad('اسم الدور مكرر', 409);
  ins('roles', { name, perms: (d.perms || []).filter(x => PERMS.includes(x)) });
  return [{ ok: 1 }, 201];
}));
route('PUT', '/roles/:id', ['users'], ({ p, body: d }) => tx(() => {
  const rid = +p.id;
  if (rid === 1) bad('لا يمكن تعديل دور المدير العام');
  const name = (d.name || '').trim(), r = M.roles.get(rid);
  if (!name) bad('اسم الدور مطلوب');
  if (!r) bad('غير موجود', 404);
  put('roles', { ...r, name, perms: (d.perms || []).filter(x => PERMS.includes(x)) });
  return { ok: 1 };
}));
route('DELETE', '/roles/:id', ['users'], ({ p }) => tx(() => {
  const rid = +p.id;
  if (rid === 1) bad('لا يمكن حذف دور المدير العام');
  if (all('users').some(u => u.role_id === rid)) bad('الدور مستخدم من قبل مستخدمين');
  del('roles', rid);
  return { ok: 1 };
}));

/* ---------- نقطة الدخول ---------- */
function seedRoles() { for (const n in ROLES) ins('roles', { name: n, perms: ROLES[n].slice() }); }
async function init(be) {
  backend = be || (typeof indexedDB !== 'undefined' ? idbBackend() : memBackend());
  const data = await backend.load();
  for (const t of TABLES) M[t] = new Map((data[t] || []).map(r => [r.id, r]));
  const meta = (data.meta || []).find(r => r.id === 'seq') || {};
  SEQ = {}; for (const k in meta) if (k !== 'id') SEQ[k] = meta[k];
  for (const t of TABLES) for (const r of M[t].values()) if (typeof r.id === 'number' && r.id > (SEQ[t] || 0)) SEQ[t] = r.id;
  if (!M.roles.size) await tx(() => seedRoles());
  CU = curUser();
}

async function api(url, o = {}) {
  const method = o.method || (o.body ? 'POST' : 'GET');
  const [path, qs] = url.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const body = o.body ? J(o.body) : {};
  for (const r of R) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    await chain;
    CU = curUser();
    if (r.perms) {
      if (!CU) throw Object.assign(new HttpError('انتهت الجلسة، سجّل الدخول', 401));
      if (r.perms.length && !r.perms.some(p => CU.perms.includes(p))) throw new HttpError('لا تملك صلاحية لهذا الإجراء', 403);
    }
    let out = await r.fn({ p: m.groups || {}, query, body });
    if (Array.isArray(out) && out.length === 2 && typeof out[1] === 'number') out = out[0];
    return out;
  }
  throw new HttpError('مسار غير معروف', 404);
}

const Local = { init, api, memBackend, HttpError, PERMS };
if (typeof module !== 'undefined' && module.exports) module.exports = Local; else root.Local = Local;
})(typeof window !== 'undefined' ? window : globalThis);
