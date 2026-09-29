const { getPool, cors } = require('../_db');
const { getRole, requireAnyRole, requireAdmin } = require('../_auth');

function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  return b || {};
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const q = req.query || {};
  const type = q.type || 'settings';

  try {
    const pool = getPool();

    if (type === 'settings') {
      if (req.method === 'GET') {
        if (!requireAnyRole(req, res)) return;
        const [rows] = await pool.query('SELECT key_name, `value`, updated_at FROM store_settings ORDER BY key_name');
        return res.status(200).json({ success: true, settings: rows });
      }
      if (req.method === 'POST') {
        if (!requireAdmin(req, res)) return;
        const b = parseBody(req);
        const key = String(b.key_name || '').trim().toLowerCase();
        const value = String(b.value || '').trim().slice(0, 1000);
        if (!/^[a-z0-9_]{2,64}$/.test(key) || !value) {
          return res.status(400).json({ error: 'key_name (a-z, 0-9, _) and value are required' });
        }
        await pool.query(
          'INSERT INTO store_settings (key_name, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
          [key, value]
        );
        return res.status(200).json({ success: true });
      }
      if (req.method === 'DELETE') {
        if (!requireAdmin(req, res)) return;
        await pool.query('DELETE FROM store_settings WHERE key_name = ?', [String(q.key || '')]);
        return res.status(200).json({ success: true });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (type === 'conversations' || type === 'messages') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      if (!requireAdmin(req, res)) return;
      if (type === 'messages') {
        const [rows] = await pool.query(
          'SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id', [Number(q.id) || 0]);
        return res.status(200).json({ success: true, messages: rows });
      }
      const [rows] = await pool.query(
        `SELECT c.id, c.session_id, c.last_active_at, COUNT(m.id) AS messages,
           (SELECT LEFT(content, 120) FROM ai_messages WHERE conversation_id = c.id AND role = 'user' ORDER BY id LIMIT 1) AS first_question
         FROM ai_conversations c LEFT JOIN ai_messages m ON m.conversation_id = c.id
         GROUP BY c.id, c.session_id, c.last_active_at
         ORDER BY c.last_active_at DESC LIMIT 100`);
      return res.status(200).json({ success: true, conversations: rows });
    }

    return res.status(400).json({ error: 'Unknown type' });
  } catch (e) {
    console.error('Admin assistant failed:', e.message);
    return res.status(500).json({ error: 'Request failed.', detail: getRole(req) ? String(e.message).slice(0, 300) : undefined });
  }
};
