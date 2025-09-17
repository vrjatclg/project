import { debounce, formatINR, generatePaymentCode, copyToClipboard } from './utils.js';
import {
  onMenuItems,
  getStudent,
  createOrder,
} from './storage.js';

const els = {
  grid: document.getElementById('menuGrid'),
  search: document.getElementById('searchInput'),
  showUnavailable: document.getElementById('showUnavailable'),
  cartBtn: document.getElementById('cartBtn'),
  cartDrawer: document.getElementById('cartDrawer'),
  scrim: document.getElementById('scrim'),
  closeCart: document.getElementById('closeCartBtn'),
  cartItems: document.getElementById('cartItems'),
  subtotal: document.getElementById('subtotal'),
  cartCount: document.getElementById('cartCount'),
  checkoutBtn: document.getElementById('checkoutBtn'),
  pidDialog: document.getElementById('pidDialog'),
  pidForm: document.getElementById('pidForm'),
  pidInput: document.getElementById('pidInput'),
  pidWarnings: document.getElementById('pidWarnings'),
  cancelPid: document.getElementById('cancelPid'),
  paymentDialog: document.getElementById('paymentDialog'),
  paymentTotal: document.getElementById('paymentTotal'),
  cancelPaymentBtn: document.getElementById('cancelPaymentBtn'),
  generatePaymentCodeBtn: document.getElementById('generatePaymentCodeBtn'),
  paymentCodeBlock: document.getElementById('paymentCodeBlock'),
  paymentCodeText: document.getElementById('paymentCodeText'),
  copyPayCodeBtn: document.getElementById('copyPayCodeBtn'),
  viewOrdersBtn: document.getElementById('viewOrdersBtn'),
  ordersDialog: document.getElementById('ordersDialog'),
  ordersForm: document.getElementById('ordersForm'),
  ordersPidInput: document.getElementById('ordersPidInput'),
  ordersCancelBtn: document.getElementById('ordersCancelBtn'),
  ordersList: document.getElementById('ordersList'),
  studentNotice: document.getElementById('studentNotice'),
};

let menu = [];
let filtered = [];
let cart = []; // {id, name, price, image, qty}

const openCart = () => {
  els.cartDrawer.classList.add('open');
  els.scrim.classList.add('open');
};
const closeCart = () => {
  els.cartDrawer.classList.remove('open');
  els.scrim.classList.remove('open');
};

const renderMenu = () => {
  const q = (els.search.value || '').toLowerCase();
  filtered = menu.filter(m => m.name.toLowerCase().includes(q));
  els.grid.innerHTML = '';
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card menu-card';
    card.innerHTML = `
      <img class="menu-img" src="${item.image || 'https://picsum.photos/seed/'+encodeURIComponent(item.name)+'/400/400'}" alt="${item.name}">
      <div class="menu-title row spread">
        <span>${item.name}</span>
        <strong>₹ ${formatINR(item.price)}</strong>
      </div>
      <div class="menu-sub">
        <span class="muted small">${item.available ? 'Available' : 'Unavailable'}</span>
        <div class="qty-row">
          <input type="number" min="1" value="1" ${item.available ? '' : 'disabled'} />
          <button class="btn" ${item.available ? '' : 'disabled'}>Add</button>
        </div>
      </div>
    `;
    const qtyInput = card.querySelector('input[type="number"]');
    const addBtn = card.querySelector('button.btn');
    addBtn.addEventListener('click', () => {
      const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
      addToCart(item, qty);
    });
    els.grid.appendChild(card);
  });
};

const addToCart = (item, qty) => {
  const i = cart.findIndex(c => c.id === item.id);
  if (i >= 0) cart[i].qty += qty;
  else cart.push({ id: item.id, name: item.name, price: item.price, image: item.image, qty });
  updateCartUI();
  openCart();
};

const removeFromCart = (id) => {
  cart = cart.filter(c => c.id !== id);
  updateCartUI();
};

const updateQty = (id, qty) => {
  const it = cart.find(c => c.id === id);
  if (!it) return;
  it.qty = Math.max(1, qty);
  updateCartUI();
};

const updateCartUI = () => {
  els.cartItems.innerHTML = '';
  let sub = 0;
  cart.forEach(c => {
    sub += c.qty * c.price;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <img src="${c.image || 'https://picsum.photos/seed/'+encodeURIComponent(c.name)+'/200/200'}" alt="${c.name}">
      <div class="grow">
        <div class="row spread">
          <strong>${c.name}</strong>
          <span>₹ ${formatINR(c.price)}</span>
        </div>
        <div class="row spread">
          <div class="row gap">
            <span class="small muted">Qty</span>
            <input class="qty" type="number" min="1" value="${c.qty}">
          </div>
          <button class="icon-btn remove">Remove</button>
        </div>
      </div>
    `;
    row.querySelector('.qty').addEventListener('change', (e) => {
      const v = parseInt(e.target.value || '1', 10);
      updateQty(c.id, v);
    });
    row.querySelector('.remove').addEventListener('click', () => removeFromCart(c.id));
    els.cartItems.appendChild(row);
  });
  els.subtotal.textContent = formatINR(sub);
  els.cartCount.textContent = String(cart.reduce((a, b) => a + b.qty, 0));
  els.checkoutBtn.disabled = cart.length === 0;
};

const resetPaymentUI = () => {
  els.paymentCodeBlock.hidden = true;
  els.paymentCodeText.textContent = '';
};

const checkoutFlow = async () => {
  if (!cart.length) return;
  resetPaymentUI();
  els.paymentTotal.textContent = els.subtotal.textContent;
  // Ask for PID first
  els.pidWarnings.textContent = '';
  els.pidInput.value = '';
  els.pidDialog.showModal();
};

const handlePidSubmit = async (e) => {
  e.preventDefault();
  const pid = els.pidInput.value.trim().toUpperCase();
  if (!pid) return;

  const student = await getStudent(pid);
  if (student?.blocked) {
    els.pidWarnings.innerHTML = `This PID is blocked. ${student.blockReason ? '(' + student.blockReason + ')' : ''}`;
    return;
  }

  els.pidDialog.close();
  els.paymentDialog.showModal();
};

const placeOrderAfterPayment = async () => {
  // Generate payment code, create order in Firestore
  const pid = els.pidInput.value.trim().toUpperCase();
  const items = cart.map(c => ({
    itemId: c.id,
    name: c.name,
    price: c.price,
    qty: c.qty,
    subtotal: c.price * c.qty,
  }));
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const seed = pid + ':' + subtotal + ':' + Date.now();
  const code = (await generatePaymentCode(seed)).toUpperCase();

  await createOrder({
    pid,
    items,
    subtotal,
    status: 'PAID_UNVERIFIED',
    paymentCode: code
  });

  els.paymentCodeText.textContent = code;
  els.paymentCodeBlock.hidden = false;

  // Clear cart
  cart = [];
  updateCartUI();
};

const renderOrdersList = (orders) => {
  els.ordersList.innerHTML = '';
  if (!orders.length) {
    els.ordersList.innerHTML = `<div class="muted small">No orders found.</div>`;
    return;
  }
  orders.forEach(o => {
    const div = document.createElement('div');
    div.className = 'order-card';
    div.innerHTML = `
      <div class="row spread">
        <strong>${o.pid}</strong>
        <span class="status ${o.status}">${o.status}</span>
      </div>
      <div class="small muted">${o.paymentCode ? 'Code: ' + o.paymentCode : ''}</div>
      <div class="order-items">
        ${o.items.map(it => `
          <div class="order-item">
            <span>${it.name} × ${it.qty}</span>
            <span>₹ ${formatINR(it.subtotal)}</span>
          </div>
        `).join('')}
      </div>
      <div class="row spread">
        <strong>Total</strong>
        <strong>₹ ${formatINR(o.subtotal)}</strong>
      </div>
      <div class="row gap mt">
        <button class="btn ghost close">Close</button>
        <button class="btn danger cancel" ${['VERIFIED','FULFILLED','CANCELLED'].includes(o.status) ? 'disabled' : ''}>Cancel</button>
      </div>
    `;
    div.querySelector('.close').addEventListener('click', () => els.ordersDialog.close());
    div.querySelector('.cancel').addEventListener('click', async () => {
      const ok = confirm('Cancel this order? This may lead to auto-block on repeated cancellations.');
      if (!ok) return;
      const { cancelOrder } = await import('./storage.js');
      await cancelOrder(o.id, o.pid);
      alert('Order cancelled.');
      document.getElementById('ordersForm').dispatchEvent(new Event('submit'));
    });
    els.ordersList.appendChild(div);
  });
};

// Event wiring
els.search.addEventListener('input', debounce(renderMenu, 150));
els.cartBtn.addEventListener('click', openCart);
els.closeCart.addEventListener('click', closeCart);
els.scrim.addEventListener('click', closeCart);
els.checkoutBtn.addEventListener('click', checkoutFlow);
els.cancelPid.addEventListener('click', () => els.pidDialog.close());
els.pidForm.addEventListener('submit', handlePidSubmit);
els.cancelPaymentBtn.addEventListener('click', () => els.paymentDialog.close());
els.generatePaymentCodeBtn.addEventListener('click', placeOrderAfterPayment);
els.copyPayCodeBtn.addEventListener('click', async () => {
  const ok = await copyToClipboard(els.paymentCodeText.textContent);
  if (ok) alert('Payment code copied!');
});
els.viewOrdersBtn.addEventListener('click', () => {
  els.ordersPidInput.value = '';
  els.ordersList.innerHTML = '';
  els.ordersDialog.showModal();
});
els.ordersCancelBtn.addEventListener('click', () => els.ordersDialog.close());

els.ordersForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pid = els.ordersPidInput.value.trim().toUpperCase();
  if (!pid) return;
  const { getOrdersByPid } = await import('./storage.js');
  const orders = await getOrdersByPid(pid);
  renderOrdersList(orders);
});

// Live menu
onMenuItems((items) => {
  menu = items;
  renderMenu();
}, { includeUnavailable: document.getElementById('showUnavailable')?.checked });

document.getElementById('showUnavailable')?.addEventListener('change', () => {
  location.reload();
});

updateCartUI();
