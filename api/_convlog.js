const { getPool } = require('./_db');

async function logTurn(sid, userText, reply) {
  try {
    sid = String(sid || '').trim().slice(0, 64);
    if (!sid) return;
    const pool = getPool();
    await pool.execute(
      'INSERT INTO ai_conversations (session_id) VALUES (?) ON DUPLICATE KEY UPDATE last_active_at = NOW()',
      [sid]
    );
    const [[conv]] = await pool.execute('SELECT id FROM ai_conversations WHERE session_id = ? LIMIT 1', [sid]);
    if (userText) {
      await pool.execute('INSERT INTO ai_messages (conversation_id, role, content) VALUES (?,?,?)',
        [conv.id, 'user', String(userText).slice(0, 4000)]);
    }
    if (reply) {
      await pool.execute('INSERT INTO ai_messages (conversation_id, role, content) VALUES (?,?,?)',
        [conv.id, 'assistant', String(reply).slice(0, 4000)]);
    }
  } catch (e) {
    console.error('Conversation logging failed:', e.message);
  }
}

module.exports = { logTurn };
