const API = '/api/admin/assistant';
let settingsMap = {};

function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

async function loadSettings() {
    const body = document.getElementById('settingsTable');
    try {
        const res = await adminFetch(API + '?type=settings');
        if (!res.ok) throw new Error('API request failed (' + res.status + ')');
        const data = await res.json();
        const rows = data.settings || [];
        settingsMap = {};
        rows.forEach(s => { settingsMap[s.key_name] = s.value; });
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="4">No settings yet. Add one below.</td></tr>';
        } else {
            body.innerHTML = rows.map(s => `
            <tr>
                <td>${escapeHTML(s.key_name)}</td>
                <td>${escapeHTML(s.value)}</td>
                <td>${s.updated_at ? new Date(s.updated_at).toLocaleDateString('en-PK') : ''}</td>
                <td><button class="btn-sm edit-btn" data-action="edit" data-key="${escapeHTML(s.key_name)}">Edit</button>
                    <button class="btn-sm delete-btn" data-action="delete" data-key="${escapeHTML(s.key_name)}">Delete</button></td>
            </tr>`).join('');
        }
        if (!isAdmin()) {
            document.getElementById('settingsForm').style.display = 'none';
            applyRoleUI();
        }
    } catch (err) {
        console.error(err);
        body.innerHTML = '<tr><td colspan="4">Could not load settings: ' + escapeHTML(err.message) + '</td></tr>';
    }
}

async function loadConversations() {
    const body = document.getElementById('convTable');
    if (!isAdmin()) {
        body.innerHTML = '<tr><td colspan="4">Admin key required to view conversations.</td></tr>';
        return;
    }
    try {
        const res = await adminFetch(API + '?type=conversations');
        if (!res.ok) throw new Error('API request failed (' + res.status + ')');
        const data = await res.json();
        const rows = data.conversations || [];
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="4">No conversations yet.</td></tr>';
            return;
        }
        body.innerHTML = rows.map(c => `
            <tr>
                <td>${c.last_active_at ? new Date(c.last_active_at).toLocaleString('en-PK') : ''}</td>
                <td>${escapeHTML(c.first_question || '')}</td>
                <td>${escapeHTML(c.messages)}</td>
                <td><button class="btn-sm" data-conv="${Number(c.id)}">View</button></td>
            </tr>`).join('');
    } catch (err) {
        console.error(err);
        body.innerHTML = '<tr><td colspan="4">Could not load conversations: ' + escapeHTML(err.message) + '</td></tr>';
    }
}

document.getElementById('settingsTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const key = btn.dataset.key;
    if (btn.dataset.action === 'edit') {
        document.getElementById('skey').value = key;
        document.getElementById('sval').value = settingsMap[key] || '';
        document.getElementById('sval').focus();
        return;
    }
    if (!confirm('Delete setting "' + key + '"?')) return;
    try {
        const res = await adminFetch(API + '?type=settings&key=' + encodeURIComponent(key), { method: 'DELETE' });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Delete failed (' + res.status + ')'); }
        loadSettings();
    } catch (err) {
        alert('Could not delete: ' + err.message);
    }
});

document.getElementById('saveSetting').addEventListener('click', async () => {
    const key = document.getElementById('skey').value.trim();
    const value = document.getElementById('sval').value.trim();
    const msg = document.getElementById('settingsMsg');
    msg.textContent = '';
    try {
        const res = await adminFetch(API + '?type=settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key_name: key, value: value })
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Save failed (' + res.status + ')'); }
        document.getElementById('skey').value = '';
        document.getElementById('sval').value = '';
        msg.textContent = 'Saved. Live for the assistant within about a minute.';
        loadSettings();
    } catch (err) {
        msg.textContent = 'Could not save: ' + err.message;
    }
});

document.getElementById('clearSetting').addEventListener('click', () => {
    document.getElementById('skey').value = '';
    document.getElementById('sval').value = '';
    document.getElementById('settingsMsg').textContent = '';
});

document.getElementById('convTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-conv]');
    if (!btn) return;
    const panel = document.getElementById('convDetailPanel');
    const box = document.getElementById('convDetail');
    panel.style.display = 'block';
    box.textContent = 'Loading...';
    try {
        const res = await adminFetch(API + '?type=messages&id=' + btn.dataset.conv);
        if (!res.ok) throw new Error('API request failed (' + res.status + ')');
        const data = await res.json();
        box.innerHTML = (data.messages || []).map(m =>
            `<p style="white-space:pre-wrap;margin:0 0 10px"><b>${m.role === 'user' ? 'Customer' : 'Assistant'}:</b> ${escapeHTML(m.content)}</p>`
        ).join('') || 'No messages.';
        panel.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        box.textContent = 'Could not load messages.';
    }
});

loadSettings().then(loadConversations);
