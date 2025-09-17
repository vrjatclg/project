import { formatINR, debounce } from './utils.js';
import {
  onAuth, loginAdmin, logoutAdmin, changeAdminPassword,
  ensureDefaultSettings, onSettingsSnapshot, setCancelThreshold,
  addMenuItem, updateMenuItem, deleteMenuItem, getAllMenuOnce,
  exportAllData, findOrderByPaymentCode, updateOrderStatus,
  getStudent, setStudentBlocked,
} from './storage.js';

const els = {
  adminApp: document.getElementById('adminApp'),
  loginView: document.getElementById('loginView'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  adminPasswordInput: document.getElementById('adminPasswordInput'),
  loginError: document.getElementById('loginError'),

  ordersTable: document.getElementById('ordersTable'),
  orderSearch: document.getElementById('orderSearch'),
  statusFilter: document.getElementById('statusFilter'),
  refreshOrders: document.getElementById('refreshOrders'),

  verifyCodeInput: document.getElementById('verifyCodeInput'),
  verifyCodeBtn: document.getElementById('verifyCodeBtn'),
  verifyResult: document.getElementById('verifyResult'),

  studentPidInput: document.getElementById('studentPidInput'),
  checkStudentBtn: document.getElementById('checkStudentBtn'),
  studentStatus: document.getElementById('studentStatus'),
  blockStudentBtn: document.getElementById('blockStudentBtn'),
  unblockStudentBtn: document.getElementById('unblockStudentBtn'),

  addMenuItemBtn: document.getElementById('addMenuItemBtn'),
  menuTable: document.getElementById('menuTable'),

  cancelThresholdDisplay: document.getElementById('cancelThresholdDisplay'),
  incThreshold: document.getElementById('incThreshold'),
  decThreshold: document.getElementById('decThreshold'),

  newPassword: document.getElementById('newPassword'),
  changePasswordBtn: document.getElementById('changePasswordBtn'),

  exportDataBtn: document.getElementById('exportDataBtn'),
  importDataBtn: document.getElementById('importDataBtn'),
  importFile: document.getElementById('importFile'),
  resetDataBtn: document.getElementById('resetDataBtn'),

  // modal
  menuModal: document.getElementById('menuModal'),
  menuForm: document.getElementById('menuForm'),
  menuModalTitle: document.getElementById('menuModalTitle'),
  menuItemId: document.getElementById('menuItemId'),
  menuName: document.getElementById('menuName'),
  menuPrice: document.getElementById('menuPrice'),
  menuImage: document.getElementById('menuImage'),
  menuAvailable: document.getElementById('menuAvailable'),
  menuCancelBtn: document.getElementById('menuCancelBtn'),
};

let ordersCache = []; // local data snapshot (view only)
let settingsCache = null;

const showAdmin = (show) => {
  els.adminApp.hidden = !show;
  els.loginView.hidden = show;
};

onAuth(async (user) => {
  if (user) {
    showAdmin(true);
    await ensureDefaultSettings();
    wireSettings();
    await refreshOrdersTable();
    await renderMenuTable();
  } else {
    showAdmin(false);
  }
});

// ---------- Login / Logout ----------
els.loginBtn.addEventListener('click', async () => {
  const pwd = els.adminPasswordInput.value;
  els.loginError.hidden = true;
  try {
    await loginAdmin(pwd);
  } catch (e) {
    console.error(e);
    els.loginError.hidden = false;
  }
});

els.logoutBtn.addEventListener('click', async () => {
  await (await import('./storage.js')).logoutAdmin();
});

// ---------- Settings ----------
const wireSettings = () => {
  onSettingsSnapshot((s) => {
    settingsCache = s || { cancelThreshold: 2 };
    els.cancelThresholdDisplay.textContent = settingsCache.cancelThreshold;
  });
};

els.incThreshold.addEventListener('click', async () => {
  const n = (settingsCache?.cancelThreshold ?? 2) + 1;
  await setCancelThreshold(n);
});
els.decThreshold.addEventListener('click', async () => {
  const n = Math.max(0, (settingsCache?.cancelThreshold ?? 2) - 1);
  await setCancelThreshold(n);
});

els.changePasswordBtn.addEventListener('click', async () => {
  const np = els.newPassword.value.trim();
  if (np.length < 6) {
    alert('Password should be at least 6 characters.');
    return;
  }
  try {
    await changeAdminPassword(np);
    els.newPassword.value = '';
    alert('Password updated.');
  } catch (e) {
    console.error(e);
    alert('Failed to update password. Try logging in again.');
  }
});

// ---------- Menu ----------
els.addMenuItemBtn.addEventListener('click', () => {
  els.menuModalTitle.textContent = 'Add Menu Item';
  els.menuItemId.value = '';
  els.menuName.value = '';
  els.menuPrice.value = '';
  els.menuImage.value = '';
  els.menuAvailable.checked = true;
  els.menuModal.showModal();
});

els.menuCancelBtn.addEventListener('click', () => els.menuModal.close());

els.menuForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: els.menuName.value.trim(),
    price: Number(els.menuPrice.value || 0),
    image: els.menuImage.value.trim(),
    available: !!els.menuAvailable.checked,
  };
  try {
    if (els.menuItemId.value) {
      await updateMenuItem(els.menuItemId.value, payload);
    } else {
      await addMenuItem(payload);
    }
    els.menuModal.close();
    await renderMenuTable();
  } catch (e) {
    console.error(e);
    alert('Failed to save item.');
  }
});

const renderMenuTable = async () => {
  const items = await getAllMenuOnce();
  const rows = items.sort((a,b)=>a.name.localeCompare(b.name)).map(it => `
    <tr>
      <td>${it.name}</td>
      <td>₹ ${formatINR(it.price)}</td>
      <td>${it.available ? 'Yes' : 'No'}</td>
      <td><a href="${it.image || '#'}" target="_blank" class="small">${it.image ? 'View' : ''}</a></td>
      <td class="row gap">
        <button class="btn ghost edit" data-id="${it.id}">Edit</button>
        <button class="btn danger del" data-id="${it.id}">Delete</button>
      </td>
    </tr>
  `).join('');
  els.menuTable.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Price</th><th>Available</th><th>Image</th><th>Actions</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="small muted">No items.</td></tr>'}</tbody>
    </table>
  `;
  els.menuTable.querySelectorAll('.edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const it = items.find(i => i.id === id);
      if (!it) return;
      els.menuModalTitle.textContent = 'Edit Menu Item';
      els.menuItemId.value = it.id;
      els.menuName.value = it.name;
      els.menuPrice.value = it.price;
      els.menuImage.value = it.image || '';
      els.menuAvailable.checked = !!it.available;
      els.menuModal.showModal();
    });
  });
  els.menuTable.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Delete this menu item?')) {
        await deleteMenuItem(id);
        await renderMenuTable();
      }
    });
  });
};

// ---------- Orders ----------
const fetchOrders = async () => {
  const { getDocs, query, orderBy, collection } = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  const { db } = await import('./firebase.js');
  const col = collection(db, 'orders');
  const q = query(col, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  return rows;
};

const renderOrdersTable = (rows) => {
  const q = (els.orderSearch.value || '').toLowerCase();
  const status = els.statusFilter.value;
  const filtered = rows.filter(r => {
    const hay = [r.pid, r.paymentCode, r.status].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!status || r.status === status);
  });
  const body = filtered.map(o => `
    <tr>
      <td class="small">${o.id}</td>
      <td>${o.pid}</td>
      <td>${o.items.map(i=>`${i.name}×${i.qty}`).join(', ')}</td>
      <td>₹ ${formatINR(o.subtotal)}</td>
      <td><span class="status ${o.status}">${o.status}</span></td>
      <td class="small">${o.paymentCode || ''}</td>
      <td class="row gap">
        <button class="btn ghost verify" data-id="${o.id}" ${o.status==='PAID_UNVERIFIED'?'':'disabled'}>Mark Verified</button>
        <button class="btn" data-act="fulfill" data-id="${o.id}" ${o.status==='VERIFIED'?'':'disabled'}>Fulfill</button>
        <button class="btn danger" data-act="delete" data-id="${o.id}">Delete</button>
      </td>
    </tr>
  `).join('');
  els.ordersTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th><th>PID</th><th>Items</th><th>Total</th><th>Status</th><th>Code</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>${body || '<tr><td colspan="7" class="small muted">No orders.</td></tr>'}</tbody>
    </table>
  `;
  els.ordersTable.querySelectorAll('.verify').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await updateOrderStatus(id, 'VERIFIED', { paymentVerifiedAt: new Date() });
      await refreshOrdersTable();
    });
  });
  els.ordersTable.querySelectorAll('[data-act]').forEach(btn => {
    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    btn.addEventListener('click', async () => {
      if (act === 'fulfill') {
        await updateOrderStatus(id, 'FULFILLED');
      } else if (act === 'delete') {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
        const { db } = await import('./firebase.js');
        if (confirm('Delete this order?')) await deleteDoc(doc(db, 'orders', id));
      }
      await refreshOrdersTable();
    });
  });
};

const refreshOrdersTable = async () => {
  ordersCache = await fetchOrders();
  renderOrdersTable(ordersCache);
};

els.refreshOrders.addEventListener('click', refreshOrdersTable);
els.orderSearch.addEventListener('input', debounce(()=>renderOrdersTable(ordersCache), 200));
els.statusFilter.addEventListener('change', ()=>renderOrdersTable(ordersCache));

// Verify payment code
els.verifyCodeBtn.addEventListener('click', async () => {
  const code = els.verifyCodeInput.value.trim().toUpperCase();
  els.verifyResult.textContent = '';
  if (!code) return;
  const order = await findOrderByPaymentCode(code);
  if (!order) {
    els.verifyResult.textContent = 'No order found for this code.';
    return;
  }
  if (order.status !== 'PAID_UNVERIFIED') {
    els.verifyResult.textContent = `Order found (status: ${order.status}).`;
    return;
  }
  await updateOrderStatus(order.id, 'VERIFIED', { paymentVerifiedAt: new Date() });
  els.verifyResult.textContent = `Order ${order.id} marked VERIFIED.`;
  await refreshOrdersTable();
});

// ---------- Student status ----------
els.checkStudentBtn.addEventListener('click', async () => {
  const pid = els.studentPidInput.value.trim().toUpperCase();
  if (!pid) return;
  const st = await getStudent(pid);
  const { getCancellationCount24h } = await import('./storage.js');
  const cnt = await getCancellationCount24h(pid);
  els.studentStatus.innerHTML = `
    Blocked: <strong>${st.blocked ? 'Yes' : 'No'}</strong><br/>
    ${st.blockReason ? `Reason: ${st.blockReason}<br/>` : ''}
    Cancellations (24h): <strong>${cnt}</strong>
  `;
  els.blockStudentBtn.disabled = st.blocked;
  els.unblockStudentBtn.disabled = !st.blocked;
});

els.blockStudentBtn.addEventListener('click', async () => {
  const pid = els.studentPidInput.value.trim().toUpperCase();
  await setStudentBlocked(pid, true, 'Blocked by admin');
  alert('Blocked');
  els.checkStudentBtn.click();
});

els.unblockStudentBtn.addEventListener('click', async () => {
  const pid = els.studentPidInput.value.trim().toUpperCase();
  await setStudentBlocked(pid, false);
  alert('Unblocked');
  els.checkStudentBtn.click();
});

// ---------- Export / Import / Reset ----------
els.exportDataBtn.addEventListener('click', async () => {
  const data = await exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `canteen-export-${new Date().toISOString().slice(0,19)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

els.importDataBtn.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  const { setDoc, doc, addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  const { db } = await import('./firebase.js');
  if (data.settings) await setDoc(doc(db, 'settings', 'globals'), data.settings, { merge: true });
  if (Array.isArray(data.menu)) {
    for (const m of data.menu) {
      const id = m.id || null;
      const payload = { ...m };
      delete payload.id;
      if (id) await setDoc(doc(db, 'menu', id), payload, { merge: true });
    }
  }
  if (Array.isArray(data.orders)) {
    for (const o of data.orders) {
      const payload = { ...o };
      delete payload.id;
      await addDoc(collection(db, 'orders'), payload);
    }
  }
  alert('Import complete.');
  await renderMenuTable();
  await refreshOrdersTable();
});

els.resetDataBtn.addEventListener('click', async () => {
  if (!confirm('This will delete ALL menu and orders. Continue?')) return;
  const { getDocs, collection, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  const { db } = await import('./firebase.js');
  for (const name of ['menu', 'orders']) {
    const snap = await getDocs(collection(db, name));
    const ops = [];
    snap.forEach(d => ops.push(deleteDoc(doc(db, name, d.id))));
    await Promise.all(ops);
  }
  alert('Factory reset complete.');
  await renderMenuTable();
  await refreshOrdersTable();
});
