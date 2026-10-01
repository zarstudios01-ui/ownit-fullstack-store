const crypto = require('crypto');
const { getPool, cors } = require('./_db');
let ready = false;
async function init(db) {
  if (ready) return;
  await db.execute("CREATE TABLE IF NOT EXISTS designs (id VARCHAR(32) PRIMARY KEY, status VARCHAR(20) DEFAULT 'confirmed', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
  await db.execute("CREATE TABLE IF NOT EXISTS design_panels (id INT AUTO_INCREMENT PRIMARY KEY, design_id VARCHAR(32) NOT NULL, panel_key VARCHAR(20) NOT NULL, kind VARCHAR(20), transform_json TEXT, image MEDIUMTEXT NOT NULL, INDEX(design_id))");
  try { await db.execute("ALTER TABLE order_items ADD COLUMN design_id VARCHAR(32) NULL"); } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
  ready = true;
}
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const db = getPool();
    await init(db);
    if (req.method === 'POST') {
      const d = req.body;
      const keys = ['left', 'right', 'controller'];
      if (!d || !Array.isArray(d.panels) || !d.panels.length || d.panels.length > 3)
        return res.status(400).json({ error: '1 to 3 panels required' });
      for (const p of d.panels) {
        if (!keys.includes(p.key) || typeof p.image !== 'string' ||
            !/^data:image\/(jpeg|png|webp);base64,/.test(p.image.slice(0, 40)) || p.image.length > 2500000)
          return res.status(400).json({ error: 'Invalid panel: ' + (p && p.key) });
      }
      const id = crypto.randomBytes(12).toString('hex');
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute('INSERT INTO designs (id) VALUES (?)', [id]);
        for (const p of d.panels) {
          await conn.execute(
            'INSERT INTO design_panels (design_id, panel_key, kind, transform_json, image) VALUES (?,?,?,?,?)',
            [id, p.key, p.kind || null, JSON.stringify(p.transform || {}), p.image]);
        }
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
      return res.status(201).json({ design_id: id });
    }
    if (req.method === 'GET') {
      const id = req.query.id, panel = req.query.panel;
      if (!/^[a-f0-9]{24}$/.test(id || '')) return res.status(400).json({ error: 'Bad id' });
      if (panel) {
        const [r] = await db.execute('SELECT image FROM design_panels WHERE design_id=? AND panel_key=?', [id, panel]);
        if (!r.length) return res.status(404).json({ error: 'Not found' });
        const m = r[0].image.match(/^data:(image\/\w+);base64,([\s\S]*)$/);
        res.setHeader('Content-Type', m[1]);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.status(200).send(Buffer.from(m[2], 'base64'));
      }
      const [d] = await db.execute('SELECT id, status, created_at FROM designs WHERE id=?', [id]);
      if (!d.length) return res.status(404).json({ error: 'Not found' });
      const [ps] = await db.execute('SELECT panel_key, kind, transform_json FROM design_panels WHERE design_id=?', [id]);
      return res.json({ ...d[0], panels: ps });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('designs error', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
