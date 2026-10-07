const { getPool, cors } = require('../_db');
const { requireAnyRole } = require('../_auth');

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
    const [rows] = await pool.execute(`
      SELECT c.*,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total), 0) AS total_spent
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);

    const output = role === 'viewer'
      ? rows.map(r => ({
          ...r,
          name: mask(r.name, 1),
          email: mask(r.email, 2),
          phone: mask(r.phone, 3),
          total_spent: null,
        }))
      : rows;

    res.status(200).json({ success: true, customers: output });
  } catch (e) {
    console.error('Admin customers list failed:', e.message);
    res.status(500).json({ error: 'Could not fetch customers.' });
  }
};
