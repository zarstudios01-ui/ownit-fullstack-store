const { getPool, cors } = require('./_db');
const { requireAdmin, requireAnyRole } = require('./_auth');

const ALLOWED = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const mask = (v, n) => { const s = String(v || ''); return s ? s.slice(0, n) + '***' : ''; };

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    let d = req.body;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
    const orderId = parseInt(d && d.order_id) || 0;
    const status = (d && d.status) || '';
    if (orderId <= 0 || !ALLOWED.includes(status)) {
      return res.status(400).json({ error: 'Valid order_id and status are required' });
    }
    try {
      const pool = getPool();
      const [r] = await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
      if (r.affectedRows === 0) return res.status(404).json({ error: 'Order not found' });
      return res.status(200).json({ success: true, order_id: orderId, status });
    } catch (e) {
      console.error('Order status update failed:', e.message);
      return res.status(500).json({ error: 'Could not update order status.' });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const role = requireAnyRole(req, res);
  if (!role) return;
  try {
    const pool = getPool();
    const [orders] = await pool.query([
      'SELECT o.id, o.status, o.subtotal, o.shipping_cost, o.total,',
      'o.shipping_address, o.created_at, c.id AS customer_id,',
      'c.name AS customer_name, c.email, c.phone',
      'FROM orders o LEFT JOIN customers c ON c.id = o.customer_id',
      'ORDER BY o.id DESC'
    ].join(' '));
    if (orders.length) {
      const [items] = await pool.query(
        'SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id ASC',
        [orders.map(o => o.id)]
      );
      orders.forEach(o => { o.items = items.filter(i => i.order_id === o.id); });
    }
    const out = role === 'viewer' ? orders.map(o => ({ ...o, customer_name: mask(o.customer_name, 1), email: mask(o.email, 2), phone: null, shipping_address: null })) : orders;
    res.status(200).json({ success: true, orders: out });
  } catch (e) {
    console.error('Orders API failed:', e.message);
    res.status(500).json({ error: 'Could not load orders.' });
  }
};
