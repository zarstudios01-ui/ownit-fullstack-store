const { getPool, cors } = require('./_db');
const { notifyNewOrder } = require('./_notify');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
  if (!d || !d.name || !d.email || !Array.isArray(d.items) || !d.items.length) {
    return res.status(400).json({ error: 'name, email, and a non-empty items array are required' });
  }
  const name = String(d.name).trim();
  const email = String(d.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  const phone = String(d.phone || '').trim();
  const addr = String(d.shipping_address || '').trim();
  const subtotal = Number(d.subtotal) || 0;
  const ship = Number(d.shipping_cost) || 0;
  const total = d.total != null ? Number(d.total) : subtotal + ship;
  const validItems = d.items.filter((it) => it && it.id && it.name && it.price != null);
  if (!validItems.length) return res.status(400).json({ error: 'No valid items in order' });

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT id FROM customers WHERE email = ? LIMIT 1', [email]);
    let cid;
    if (rows.length) {
      cid = rows[0].id;
    } else {
      const [r] = await conn.execute('INSERT INTO customers (name, email, phone) VALUES (?,?,?)', [name, email, phone]);
      cid = r.insertId;
    }
    const [o] = await conn.execute(
      'INSERT INTO orders (customer_id, status, subtotal, shipping_cost, total, shipping_address) VALUES (?,?,?,?,?,?)',
      [cid, 'pending', subtotal, ship, total, addr]
    );
    for (const it of d.items) {
      if (!it.id || !it.name || it.price == null) continue;
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, product_name, variant, price, quantity) VALUES (?,?,?,?,?,?)',
        [o.insertId, String(it.id), String(it.name), String(it.variant || ''), Number(it.price), parseInt(it.qty) || 1]
      );
    }
    await conn.commit();
    await notifyNewOrder({ id: o.insertId, customer_name: name, email, phone, shipping_address: addr, total, items: d.items.map(it => ({ product_name: it.name, variant: it.variant, quantity: parseInt(it.qty) || 1 })) });
    res.status(200).json({ success: true, order_id: o.insertId });
  } catch (e) {
    await conn.rollback().catch(() => {});
    console.error('Order creation failed:', e.message);
    res.status(500).json({ error: 'Could not save order. Please try again.' });
  } finally {
    conn.release();
  }
};
