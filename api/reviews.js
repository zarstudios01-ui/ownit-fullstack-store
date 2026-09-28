const crypto = require('crypto');
const { getPool, cors } = require('./_db');
const { requireAdmin, requireAnyRole } = require('./_auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const pool = getPool();
  const q = req.query || {};
  try {
    if (req.method === 'GET' && !q.all) {
      const [rows] = await pool.query(
        `SELECT id, author, rating, body, variant_label, verified, created_at
         FROM product_reviews WHERE product_slug=? AND status='approved'
         ORDER BY created_at DESC LIMIT 50`, [q.slug]);
      const [[agg]] = await pool.query(
        `SELECT COUNT(*) c, ROUND(AVG(rating),1) avg,
         SUM(rating=5) s5, SUM(rating=4) s4, SUM(rating=3) s3,
         SUM(rating=2) s2, SUM(rating=1) s1
         FROM product_reviews WHERE product_slug=? AND status='approved'`, [q.slug]);
      return res.json({ reviews: rows, summary: agg });
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.website) return res.json({ success: true });
      const author = String(b.author || '').trim().slice(0, 40);
      const body = String(b.body || '').trim().slice(0, 600);
      const rating = parseInt(b.rating, 10);
      if (author.length < 2 || body.length < 5 || !(rating >= 1 && rating <= 5))
        return res.status(400).json({ error: 'Name, rating (1-5) and message required' });
      const [p] = await pool.query('SELECT slug FROM products WHERE slug=?', [b.slug]);
      if (!p.length) return res.status(404).json({ error: 'Unknown product' });
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const ip_hash = crypto.createHash('sha256')
        .update(ip + (process.env.ADMIN_KEY || '')).digest('hex');
      const [[r]] = await pool.query(
        `SELECT COUNT(*) c FROM product_reviews
         WHERE ip_hash=? AND created_at > NOW() - INTERVAL 1 HOUR`, [ip_hash]);
      if (r.c >= 3) return res.status(429).json({ error: 'Too many reviews, try later' });
      await pool.query(
        `INSERT INTO product_reviews (product_slug, author, rating, body, variant_label, ip_hash)
         VALUES (?,?,?,?,?,?)`,
        [b.slug, author, rating, body, String(b.variant_label || '').slice(0, 60) || null, ip_hash]);
      return res.json({ success: true });
    }
    if (req.method === 'GET') {
      if (!requireAnyRole(req, res)) return;
    } else if (!requireAdmin(req, res)) return;
    if (req.method === 'GET') {
      const [rows] = await pool.query(
        'SELECT id, product_slug, author, rating, body, status, created_at FROM product_reviews ORDER BY created_at DESC LIMIT 200');
      return res.json({ reviews: rows });
    }
    if (req.method === 'PATCH') {
      await pool.query('UPDATE product_reviews SET status=? WHERE id=?',
        [req.body.status === 'hidden' ? 'hidden' : 'approved', q.id]);
      return res.json({ success: true });
    }
    if (req.method === 'DELETE') {
      await pool.query('DELETE FROM product_reviews WHERE id=?', [q.id]);
      return res.json({ success: true });
    }
    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
