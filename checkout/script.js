const TAX_RATE = 0.0;
let shippingCost = 0;

function money(n) {
  return window.OwnItCart.pkr(n);
}

function renderSummary() {
  const cart = window.OwnItCart.getCart();
  const itemsEl = document.getElementById('summaryItems');
  const coGrid = document.getElementById('coGrid');
  const emptyEl = document.getElementById('emptyCart');

  if (cart.length === 0) {
    coGrid.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  coGrid.style.display = 'grid';
  emptyEl.style.display = 'none';

  itemsEl.innerHTML = cart.map(item =>
    `<div class="sum-item">
      <img src="${item.image}" alt="${item.name}">
      <div>
        <div class="sum-item-name">${item.name}</div>
        <div class="sum-item-variant">${item.variant || ''}</div>
        <div class="sum-item-qty">Qty ${item.qty}</div>
      </div>
      <div class="sum-item-price">${money(item.price * item.qty)}</div>
    </div>`
  ).join('');

  const subtotal = window.OwnItCart.cartTotal();
  const tax = subtotal * TAX_RATE;
  const total = subtotal + shippingCost + tax;

  document.getElementById('sumSubtotal').textContent = money(subtotal);
  document.getElementById('sumShipping').textContent =
    shippingCost === 0 ? 'Free' : money(shippingCost);
  document.getElementById('sumTax').textContent = money(tax);
  document.getElementById('sumTotal').textContent = money(total);
}

// Shipping method selection
document.querySelectorAll('.ship-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.ship-option').forEach(o => o.classList.remove('active'));

    opt.classList.add('active');
    opt.querySelector('input').checked = true;
    shippingCost = parseFloat(opt.querySelector('input').value);

    renderSummary();
  });
});

document.getElementById('promoBtn').addEventListener('click', () => {
  const btn = document.getElementById('promoBtn');
  const original = btn.textContent;

  btn.textContent = 'No active codes';
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1800);
});

// REAL ORDER SUBMISSION
document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const cart = window.OwnItCart.getCart();

  if (!cart.length) {
    alert('Your cart is empty.');
    return;
  }

  const firstName = document.getElementById('fname').value.trim();
  const lastName = document.getElementById('lname').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();

  const address = [
    document.getElementById('addr').value.trim(),
    document.getElementById('city').value.trim(),
    document.getElementById('zip').value.trim(),
    document.getElementById('country').value.trim()
  ].filter(Boolean).join(', ');

  const subtotal = window.OwnItCart.cartTotal();
  const tax = subtotal * TAX_RATE;
  const total = subtotal + shippingCost + tax;

  const orderData = {
    name: `${firstName} ${lastName}`.trim(),
    email: email,
    phone: phone,
    shipping_address: address,

    items: cart.map(item => ({
      id: item.id,
      name: item.name,
      variant: item.variant || '',
      design_id: item.design_id || null,
      price: Number(item.price),
      qty: Number(item.qty)
    })),

    subtotal: subtotal,
    shipping_cost: shippingCost,
    total: total
  };

  const placeOrderBtn = document.getElementById('placeOrderBtn');

  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = 'Saving Order...';

  try {
    const response = await fetch('/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
  throw new Error(
    result.detail
      ? `${result.error || 'Could not save order.'} — ${result.detail}`
      : (result.error || 'Could not save order.')
  );
    }

    // Use the REAL database order ID
    const realOrderId = String(result.order_id).padStart(6, '0');

    document.getElementById('orderIdLine').textContent =
      `Order #OWNIT-${realOrderId}`;

    document.getElementById('coContent').classList.add('hidden');
    document.getElementById('confirmPanel').classList.add('show');

    // Only clear cart after successful database save
    window.OwnItCart.clearCart();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  } catch (error) {
    console.error('Order submission failed:', error);

    alert(
  `Order failed: ${error.message}`
);

    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = 'Place Order';
  }
});

renderSummary();
