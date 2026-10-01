const API_URL = '/api/orders';

let orders = [];

async function loadOrders() {
    const table = document.getElementById('ordersTable');

    try {
        const response = await adminFetch(API_URL);

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Could not load orders');
        }

        orders = data.orders;

        if (!orders.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="6">No orders yet.</td>
                </tr>
            `;
            return;
        }

        table.innerHTML = orders.map(order => `
            <tr class="order-row" data-id="${order.id}">
                <td>#OWNIT-${String(order.id).padStart(6, '0')}</td>
                <td><button class="customer-link" data-id="${order.id}">${escapeHTML(order.customer_name || 'Unknown')}</button></td>
                <td>${escapeHTML(order.email || '')}</td>
                <td>
                    <span class="status-badge">
                        ${escapeHTML(order.status)}
                    </span>
                </td>
                <td>${formatMoney(order.total)}</td>
                <td>${formatDate(order.created_at)}</td>
            </tr>
        `).join('');

        document.querySelectorAll('.customer-link').forEach(button => {
            button.addEventListener('click', () => {
                showOrder(Number(button.dataset.id));
            });
        });

    } catch (error) {
        console.error(error);

        table.innerHTML = `
            <tr>
                <td colspan="6">Could not connect to backend.</td>
            </tr>
        `;
    }
}

function showOrder(id) {
    const order = orders.find(item => Number(item.id) === id);

    if (!order) return;

    const details = document.getElementById('orderDetails');
    const content = document.getElementById('detailContent');

    document.getElementById('detailOrder').textContent =
        `#OWNIT-${String(order.id).padStart(6, '0')}`;

    content.innerHTML = `
        <div class="order-info">
            <div>
                <p class="eyebrow">CUSTOMER</p>
                <strong>${escapeHTML(order.customer_name || 'Unknown')}</strong>
                <p>${escapeHTML(order.email || '')}</p>
                <p>${order.phone ? escapeHTML(order.phone) : 'Hidden, admin key required'}</p>
            </div>

            <div>
                <p class="eyebrow">SHIPPING ADDRESS</p>
                <p>${order.shipping_address ? escapeHTML(order.shipping_address) : (isAdmin() ? 'No address provided' : 'Hidden, admin key required')}</p>
            </div>

            <div>
                <p class="eyebrow">ORDER STATUS</p>
                <span class="status-badge">${escapeHTML(order.status)}</span>
                <div class="status-actions">
                    ${['pending','confirmed','shipped','delivered','cancelled'].map(st => `
                        <button class="status-btn" data-id="${order.id}" data-status="${st}" ${st === order.status ? 'disabled' : ''}>${st}</button>
                    `).join('')}
                </div>
            </div>
        </div>

        <div class="order-items">
            <p class="eyebrow">ITEMS</p>

            ${order.items.map(item => `
                <div class="order-item">
                    <div>
                        <strong>${escapeHTML(item.product_name)}</strong>
                        <p>${escapeHTML(item.variant || '')}</p>
                        ${item.design_id ? `<div style="display:flex;gap:6px;margin-top:6px">${["left","right","controller"].map(k => `<a href="/api/designs?id=${escapeHTML(item.design_id)}&panel=${k}" target="_blank" rel="noopener"><img src="/api/designs?id=${escapeHTML(item.design_id)}&panel=${k}" alt="${k} artwork" style="width:56px;height:84px;object-fit:contain;background:#eee;border:1px solid #ccc" onerror="this.parentNode.remove()"></a>`).join("")}</div>` : ""}
                    </div>

                    <div>
                        ${item.quantity} × ${formatMoney(item.price)}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="order-total">
            <span>Total</span>
            <strong>${formatMoney(order.total)}</strong>
        </div>
    `;

    content.querySelectorAll('.status-btn').forEach(b => b.addEventListener('click', () => setStatus(Number(b.dataset.id), b.dataset.status, b)));

    applyRoleUI();
    details.classList.remove('hidden');

    details.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function formatMoney(value) {
    return 'Rs. ' + Number(value).toLocaleString('en-PK');
}

function formatDate(value) {
    const date = new Date(value.replace(' ', 'T'));

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

loadOrders().then(applyRoleUI);

async function setStatus(id, status, btn) {
    btn.disabled = true;
    try {
        const r = await adminFetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: id, status })
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.error || 'Update failed');
        await loadOrders();
        showOrder(id);
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
    }
}
