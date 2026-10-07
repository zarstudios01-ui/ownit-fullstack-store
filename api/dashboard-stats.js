const { getPool, cors } = require('./_db');
const { requireAnyRole } = require('./_auth');

function mask(str, keepStart = 2) {
  if (!str) return str;
  return String(str).slice(0, keepStart) + '***';
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const role = requireAnyRole(req, res);
  if (!role) return;
  try {
    const pool = getPool();
    const [[[s]], [[cu]], [recent], [top]] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total_orders, COALESCE(SUM(total),0) AS total_revenue, COALESCE(AVG(total),0) AS average_order_value, SUM(status='pending') AS pending_orders, SUM(status='delivered') AS completed_orders, SUM(status='cancelled') AS cancelled_orders FROM orders"),
      pool.query('SELECT COUNT(*) AS total_customers FROM customers'),
      pool.query('SELECT o.id, c.name AS customer_name, c.email, o.status, o.total, o.created_at FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.id DESC LIMIT 10'),
      pool.query('SELECT product_id, product_name, SUM(quantity) AS units_sold, SUM(price*quantity) AS revenue FROM order_items GROUP BY product_id, product_name ORDER BY units_sold DESC LIMIT 10')
    ]);

    const recentOutput = role === 'viewer'
      ? recent.map(r => ({ ...r, customer_name: mask(r.customer_name, 1), email: mask(r.email, 2), total: null }))
      : recent;

    res.status(200).json({
      success: true,
      role,
      stats: {
        total_orders: Number(s.total_orders),
        total_revenue: role === 'viewer' ? null : Number(s.total_revenue),
        total_customers: Number(cu.total_customers),
        average_order_value: role === 'viewer' ? null : Number(s.average_order_value),
        pending_orders: Number(s.pending_orders || 0),
        completed_orders: Number(s.completed_orders || 0),
        cancelled_orders: Number(s.cancelled_orders || 0)
      },
      recent_orders: recentOutput,
      top_products: role === 'viewer' ? top.map(p => ({ ...p, revenue: null })) : top
    });
  } catch (e) {
    console.error('Dashboard stats failed:', e.message);
    res.status(500).json({ error: 'Could not load dashboard statistics.' });
  }
};
