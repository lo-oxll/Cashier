// node test_db.js  — يختبر طبقة البيانات (نفس سيناريوهات test_api.py)
const assert = require('assert');
const Local = require('./db.js');
const be = Local.memBackend();
(async () => {
  await Local.init(be);
  const api = Local.api;
  const fails = async (p, code) => { try { await p; } catch (e) { assert.strictEqual(e.code, code, e.message); return; } assert.fail('expected ' + code); };

  assert.strictEqual((await api('/status')).setup, true);
  await fails(api('/me'), 401);
  await fails(api('/setup', { body: { password: '123' } }), 400);
  let d = await api('/setup', { body: { password: 'admin123', shop_name: 'محل' } });
  assert.strictEqual(d.user.perms.length, 12);
  assert.strictEqual(d.settings.shop_name, 'محل');
  await api('/logout', { method: 'POST', body: {} });
  await fails(api('/login', { body: { username: 'admin', password: 'x' } }), 401);
  d = await api('/login', { body: { username: 'ADMIN', password: 'admin123' } });
  assert(d.settings);

  const p = await api('/products', { body: { name: 'قميص رجالي', category: 'قمصان', brand: 'X', cost: 5000, price: 10000, variants: [{ size: 'M', color: 'أزرق', qty: 10 }, { size: 'L', color: 'أزرق', qty: 5 }] } });
  assert.strictEqual(p.variants.length, 2);
  const bc = p.variants[0].barcode;
  assert(bc.startsWith('20') && bc.length === 10);
  let v = await api('/variants?q=' + bc); assert(v.length === 1 && v[0].qty === 10);
  v = await api('/variants?q=' + encodeURIComponent('قميص أزرق')); assert.strictEqual(v.length, 2);

  const s = (await api('/sales', { body: { items: [{ variant_id: p.variants[0].id, qty: 2 }, { variant_id: p.variants[1].id, qty: 1 }], discount: 1000, method: 'cash' } })).sale;
  assert(s.subtotal === 30000 && s.total === 29000 && s.cost_total === 15000, JSON.stringify(s));
  assert.strictEqual((await api('/variants?q=' + bc))[0].qty, 8);
  const r = (await api(`/sales/${s.id}/return`, { body: { items: [{ id: s.items[0].id, qty: 1 }] } })).sale;
  assert.strictEqual(r.total, -Math.round(10000 * 29000 / 30000));
  assert.strictEqual((await api('/variants?q=' + bc))[0].qty, 9);
  await fails(api(`/sales/${s.id}/return`, { body: { items: [{ id: s.items[0].id, qty: 5 }] } }), 400);

  const cu = await api('/customers', { body: { name: 'علي', phone: '0770' } });
  await fails(api('/sales', { body: { items: [{ variant_id: p.variants[0].id, qty: 1 }], method: 'credit' } }), 400);
  await api('/sales', { body: { items: [{ variant_id: p.variants[0].id, qty: 1 }], method: 'credit', customer_id: cu.id, paid: 3000 } });
  assert.strictEqual((await api('/customers?q=' + encodeURIComponent('علي')))[0].balance, 7000);
  assert.strictEqual((await api(`/customers/${cu.id}/pay`, { body: { amount: 2000 } })).balance, 5000);

  await api('/stock', { body: { variant_id: p.variants[1].id, mode: 'add', qty: 20, note: 'وارد' } });
  assert.strictEqual((await api('/stock', { body: { variant_id: p.variants[1].id, mode: 'set', qty: 7 } })).qty, 7);
  assert((await api('/stock/moves')).length >= 5);

  const p2 = await api(`/products/${p.id}`, { method: 'PUT', body: { name: 'قميص', price: 12000, cost: 5000, category: 'قمصان', variants: [{ ...p.variants[0], qty: p.variants[0].qty + 3, qty0: p.variants[0].qty }, { size: 'XL', color: 'أبيض', qty: 4 }], delete: [p.variants[1].id] } });
  assert(p2.variants.length === 2 && p2.price === 12000);

  const rows = [...Array(5)].map((_, i) => ({ name: 'بنطلون', category: 'بناطيل', price: '25,000', cost: '12000', size: String(28 + i), color: 'أسود', qty: '3', _n: i + 2 }));
  rows.push({ name: '', price: 1, _n: 9 }, { name: 'x', price: 'abc', _n: 10 }, { name: 'مكرر', price: 1, barcode: bc, qty: 1, _n: 11 });
  let imp = await api('/import', { body: { rows } });
  assert(imp.created === 5 && imp.errors.length === 2 && imp.updated === 1, JSON.stringify(imp));
  imp = await api('/import', { body: { rows: rows.slice(0, 5) } });
  assert(imp.updated === 5 && imp.created === 0);

  const R = await api('/reports?group=month');
  assert(R.n === 2 && R.returns === 9667 && 'profit' in R && R.top.length && R.inventory.pieces > 0, JSON.stringify(R));
  for (const g of ['day', 'week', 'year']) await api('/reports?group=' + g);
  await api('/expenses', { body: { title: 'إيجار', amount: 50000 } });
  assert.strictEqual((await api('/expenses')).total, 50000);

  const roles = await api('/roles'), cashier = roles.find(x => x.name === 'كاشير');
  await api('/users', { body: { username: 'Ahmed', name: 'احمد', password: '123456', role_id: cashier.id } });
  await fails(api('/users', { body: { username: 'ahmed', name: 'x', password: '123456', role_id: cashier.id } }), 409);
  const sp = await api('/products?q=' + encodeURIComponent('قميص'));
  assert(sp.length === 1);
  await api('/logout', { method: 'POST', body: {} });
  await api('/login', { body: { username: 'ahmed', password: '123456' } });
  await fails(api('/reports'), 403); await fails(api('/users'), 403);
  v = await api('/variants?q=' + bc); assert(!('cost' in v[0]));
  const s3 = (await api('/sales', { body: { items: [{ variant_id: v[0].id, qty: 1, price: 1 }], discount: 5000 } })).sale;
  assert(s3.total === v[0].price && !('cost_total' in s3));
  await fails(api(`/sales/${s.id}/return`, { body: { items: [] } }), 403);
  assert.strictEqual((await api('/sales')).length, 1);
  await fails(api(`/sales/${s.id}`), 404);

  await api('/logout', { method: 'POST', body: {} });
  await api('/login', { body: { username: 'admin', password: 'admin123' } });
  await api('/settings', { method: 'PUT', body: { allow_negative: '0' } });
  await fails(api('/sales', { body: { items: [{ variant_id: v[0].id, qty: 9999 }] } }), 400);
  // الاستجابة الفاشلة لا تغيّر المخزون (تراجع ذرّي)
  const before = (await api('/variants?q=' + bc))[0].qty;
  await fails(api('/sales', { body: { items: [{ variant_id: v[0].id, qty: 1 }, { variant_id: v[0].id, qty: 9999 }] } }), 400);
  assert.strictEqual((await api('/variants?q=' + bc))[0].qty, before);

  // نسخ احتياطي واسترجاع ثم إعادة تحميل من التخزين
  const bk = await api('/backup');
  await api('/wipe', { method: 'POST', body: {} });
  assert.strictEqual((await api('/status')).setup, true);
  await api('/restore', { body: bk });
  assert.strictEqual((await api('/status')).setup, false);
  await Local.init(be);
  await api('/login', { body: { username: 'admin', password: 'admin123' } });
  assert.strictEqual((await api('/variants?q=' + bc))[0].qty, before);
  const pe = await api('/export/products'); assert(pe.length === 7);
  console.log('ALL OK');
})().catch(e => { console.error(e); process.exit(1); });
