const API_URL = '/api/admin/customers';

async function loadCustomers() {
    const table = document.getElementById('customersTable');

    try {
        const response = await adminFetch(API_URL);
        if (!response.ok) throw new Error('API request failed');

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Could not load customers');

        const customers = data.customers;

        if (!customers.length) {
            table.innerHTML = `<tr><td colspan="5">No customers yet.</td></tr>`;
            return;
        }

        table.innerHTML = customers.map(c => `
            <tr>
                <td>${escapeHTML(c.name || 'Unknown')}</td>
                <td>${escapeHTML(c.email || '')}</td>
                <td>${escapeHTML(c.phone || '')}</td>
                <td>${c.order_count}</td>
                <td>${formatMoney(c.total_spent)}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error(error);
        table.innerHTML = `<tr><td colspan="5">Could not connect to backend.</td></tr>`;
    }
}

function formatMoney(value) {
    if (value === null || value === undefined) return 'Admin only';
    return 'Rs. ' + Number(value).toLocaleString('en-PK');
}

function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

loadCustomers();
