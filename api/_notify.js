const esc = v => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function notifyNewOrder(order) {
  try {
    if (!process.env.RESEND_API_KEY || !process.env.ADMIN_EMAIL) { console.error("Notify skipped: RESEND_API_KEY or ADMIN_EMAIL missing"); return; }
    const link = (process.env.SITE_URL || '') + '/admin/orders.html';
    const id = '#OWNIT-' + String(order.id).padStart(6, '0');
    const items = (order.items || []).map(i =>
      `<li>${esc(i.product_name)} ${esc(i.variant || '')} × ${esc(i.quantity)}</li>`
    ).join('');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'OwnIt Orders <onboarding@resend.dev>',
        to: [process.env.ADMIN_EMAIL],
        subject: `New order ${id}: Rs. ${Number(order.total).toLocaleString('en-PK')}`,
        html: `<h2>New order ${id}</h2>
          <p><b>${esc(order.customer_name)}</b><br>${esc(order.phone)}</p>
          <p>${esc(order.shipping_address)}</p>
          <ul>${items}</ul>
          <p><a href="${link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Open dashboard</a></p>
          <p><b>Total: Rs. ${esc(order.total)}</b></p>`
      })
    });
    if (!r.ok) console.error('Resend failed:', r.status, await r.text());
  } catch (e) {
    console.error('Notify failed:', e.message);
  }
}

module.exports = { notifyNewOrder };
