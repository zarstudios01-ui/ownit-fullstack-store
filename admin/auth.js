function askKey() {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999';
    box.innerHTML = '<div style="background:#fff;padding:24px;border-radius:12px;width:min(320px,90%)"><p style="margin:0 0 12px;font-weight:600">Admin key</p><input id="ak" type="password" autocomplete="off" style="width:100%;padding:10px;font-size:16px;box-sizing:border-box"><button id="akb" style="margin-top:12px;width:100%;padding:10px;font-size:16px">Unlock</button></div>';
    document.body.appendChild(box);
    const done = () => {
      const v = box.querySelector('#ak').value.trim();
      if (v) { box.remove(); resolve(v); }
    };
    box.querySelector('#akb').onclick = done;
    box.querySelector('#ak').onkeydown = e => { if (e.key === 'Enter') done(); };
  });
}

async function resolveRole(key) {
  try {
    const res = await fetch('/api/dashboard-stats', { headers: { 'x-admin-key': key } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.role || null;
  } catch {
    return null;
  }
}

async function adminFetch(url, options = {}) {
  let key = sessionStorage.getItem('ownit_admin_key');
  if (!key) key = await askKey();

  if (!sessionStorage.getItem('ownit_admin_role')) {
    const role = await resolveRole(key);
    if (!role) {
      sessionStorage.removeItem('ownit_admin_key');
      throw new Error('Wrong admin key');
    }
    sessionStorage.setItem('ownit_admin_role', role);
  }

  const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), 'x-admin-key': key } });
  if (res.status === 401) {
    sessionStorage.removeItem('ownit_admin_key');
    sessionStorage.removeItem('ownit_admin_role');
    throw new Error('Wrong admin key');
  }
  sessionStorage.setItem('ownit_admin_key', key);
  return res;
}

function isAdmin() {
  return sessionStorage.getItem('ownit_admin_role') === 'admin';
}

function applyRoleUI() {
  if (!isAdmin()) {
    showViewerNotice();
    document.querySelectorAll('.edit-btn, .delete-btn, .add-product-btn, .status-btn, .upload-image-btn, #addProductBtn')
      .forEach(el => { el.style.display = 'none'; });
  }
}

function showViewerNotice() {
  if (isAdmin() || document.getElementById('viewerNotice')) return;
  const isProducts = location.pathname.includes('products');
  const msg = isProducts
    ? 'Admin key required to access product details and CMS.'
    : 'Admin key required for full access.';
  const n = document.createElement('p');
  n.id = 'viewerNotice';
  n.textContent = msg;
  n.style.cssText = 'margin:16px 0;padding:10px 14px;font-size:12px;color:#666;background:#fff;border:1px solid #e5e5e0;border-radius:8px';
  (document.querySelector('main') || document.body).appendChild(n);
}
