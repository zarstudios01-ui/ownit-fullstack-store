const API_URL = '/api/reviews';

function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

async function loadReviews() {
    const table = document.getElementById('reviewsTable');
    try {
        const res = await adminFetch(API_URL + '?all=1');
        if (!res.ok) throw new Error('API request failed (' + res.status + ')');
        const data = await res.json();
        const reviews = (data.reviews || []).sort(
            (a, b) => (a.status === 'approved') - (b.status === 'approved')
        );

        if (!reviews.length) {
            table.innerHTML = '<tr><td colspan="7">No reviews yet.</td></tr>';
            return;
        }

        table.innerHTML = reviews.map(r => {
            const approved = r.status === 'approved';
            const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
            const toggle = approved
                ? `<button class="btn-sm" data-action="hidden" data-id="${r.id}">Hide</button>`
                : `<button class="btn-sm" data-action="approved" data-id="${r.id}">Approve</button>`;
            return `
            <tr>
                <td>${escapeHTML(r.product_slug)}</td>
                <td>${escapeHTML(r.author)}</td>
                <td>${stars}</td>
                <td>${escapeHTML(r.body)}</td>
                <td>${escapeHTML(r.status)}</td>
                <td>${new Date(r.created_at).toLocaleDateString('en-PK')}</td>
                <td>${toggle} <button class="btn-sm" data-action="delete" data-id="${r.id}">Delete</button></td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error(err);
        table.innerHTML = '<tr><td colspan="7">Could not load reviews.</td></tr>';
    }
}

document.getElementById('reviewsTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    try {
        let res;
        if (action === 'delete') {
            if (!confirm('Delete this review permanently?')) return;
            res = await adminFetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        } else {
            res = await adminFetch(`${API_URL}?id=${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: action })
            });
        }
        if (!res.ok) throw new Error('Action failed (' + res.status + ')');
        loadReviews();
    } catch (err) {
        alert('Could not update review: ' + err.message);
    }
});

loadReviews();
