const { getPool, cors } = require('./_db');

module.exports = async (req, res) => {
  cors(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  try {
    const pool = getPool();

    if (slug) {
      const [rows] = await pool.query(
        'SELECT slug, name, description, images, variants, category FROM products WHERE slug = ?',
        [slug]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.status(200).json(rows[0]);
    }

    const [rows] = await pool.query(
      'SELECT slug, name, description, images, variants, category FROM products'
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error('products error:', err);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
};
