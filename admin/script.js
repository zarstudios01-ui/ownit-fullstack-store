const API_URL = '/api/dashboard-stats';

function formatMoney(value) {
    if (value === null || value === undefined) return 'Admin only';
    return 'Rs. ' + Number(value).toLocaleString('en-PK');
}

async function loadDashboard() {
    const ordersTable = document.getElementById('ordersTable');
    const productsList = document.getElementById('productsList');

    try {
        const response = await adminFetch(API_URL);

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Could not load dashboard');
        }

        const stats = data.stats;

        // Main statistics
        document.getElementById('revenue').textContent =
            formatMoney(stats.total_revenue);

        document.getElementById('orders').textContent =
            stats.total_orders;

        document.getElementById('customers').textContent =
            stats.total_customers;

        document.getElementById('averageOrder').textContent =
            formatMoney(stats.average_order_value);

        // Order status statistics
        document.getElementById('pending').textContent =
            stats.pending_orders;

        document.getElementById('completed').textContent =
            stats.completed_orders;

        document.getElementById('cancelled').textContent =
            stats.cancelled_orders;

        // Recent orders
        if (!data.recent_orders.length) {
            ordersTable.innerHTML = `
                <tr>
                    <td colspan="5">No orders yet.</td>
                </tr>
            `;
        } else {
            ordersTable.innerHTML = data.recent_orders.map(order => `
                <tr>
                    <td>#OWNIT-${String(order.id).padStart(6, '0')}</td>
                    <td>${escapeHTML(order.customer_name || 'Unknown')}</td>
                    <td>
                        <span class="status-badge">
                            ${escapeHTML(order.status)}
                        </span>
                    </td>
                    <td>${formatMoney(order.total)}</td>
                    <td>${formatDate(order.created_at)}</td>
                </tr>
            `).join('');
        }

        // Top products
        if (!data.top_products.length) {
            productsList.innerHTML = 'No products yet.';
        } else {
            productsList.innerHTML = data.top_products.map(product => `
                <div class="product-row">
                    <div>
                        <div class="product-name">
                            ${escapeHTML(product.product_name)}
                        </div>
                        <div class="product-meta">
                            ${product.units_sold} unit${Number(product.units_sold) === 1 ? '' : 's'} sold
                        </div>
                    </div>

                    <div class="product-revenue">
                        ${formatMoney(product.revenue)}
                    </div>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error(error);

        ordersTable.innerHTML = `
            <tr>
                <td colspan="5">Could not connect to backend.</td>
            </tr>
        `;

        productsList.innerHTML = 'Could not load products.';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString.replace(' ', 'T'));

    if (Number.isNaN(date.getTime())) {
        return dateString;
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

loadDashboard();
