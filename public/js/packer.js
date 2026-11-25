(async function () {
  const ctx = await M.init('packer', { roles: ['staff'] });
  if (!ctx) return;

  const content = document.getElementById('content');
  const tabs = document.getElementById('tabs');
  let view = 'open';
  let orders = [];

  function itemRow(o, i) {
    const open = o.status === 'placed' || o.status === 'packing';
    let info = '';
    let actions = '';
    if (i.status === 'pending') {
      info = i.backup
        ? `<div class="small">Customer's backup: <strong>${M.esc(i.backup.name)}</strong> (${M.money(i.backup.unitPrice)})</div>`
        : '<div class="small">No backup chosen. If unavailable, remove from bill.</div>';
      if (open)
        actions = `<button class="btn primary small" data-act="packed" data-o="${o.id}" data-i="${i.id}">Packed</button>
                   <button class="btn danger small" data-act="unavailable" data-o="${o.id}" data-i="${i.id}">Out of stock</button>`;
    } else {
      if (i.status === 'packed') info = '<div class="ok small">Packed ✓</div>';
      if (i.status === 'substituted') info = `<div class="swap small">Pack <strong>${M.esc(i.backup.name)}</strong> instead (customer's choice)</div>`;
      if (i.status === 'refunded') info = '<div class="gone small">Out of stock · removed from bill (customer\u2019s choice)</div>';
      if (open) actions = `<button class="btn small" data-act="undo" data-o="${o.id}" data-i="${i.id}">Undo</button>`;
    }
    return `<div class="line"><div class="pic">${M.esc(i.emoji)}</div>
      <div class="grow"><strong>${M.esc(i.name)}</strong> <span class="small">${M.esc(i.detail)} × ${i.qty}</span>${info}</div>
      <div class="actions">${actions}</div></div>`;
  }

  function orderCard(o) {
    const open = o.status === 'placed' || o.status === 'packing';
    const pending = o.items.filter((i) => i.status === 'pending').length;
    const who = o.customer ? `${M.esc(o.customer.name)} · ${M.esc(o.address.phone)}` : M.esc(o.address.name);
    const finish = open
      ? `<button class="btn primary" data-act="complete" data-o="${o.id}" ${pending ? 'disabled' : ''}>${pending ? pending + ' item(s) left' : 'Complete order'}</button>`
      : '<span></span>';
    return `<article class="order">
      <div class="order-head">
        <div><h3>Order ${M.esc(o.orderNumber)}</h3>
        <div class="muted" style="font-size:13px">${who} · ${M.date(o.createdAt)}<br>${M.esc(o.address.line1)}, ${M.esc(o.address.city)} ${M.esc(o.address.pincode)}</div></div>
        <span class="status ${o.status}">${o.status}</span>
      </div>
      ${o.items.map((i) => itemRow(o, i)).join('')}
      <div class="order-foot">${finish}<div>Bill: <span class="price">${M.money(o.finalTotal)}</span> <span class="muted small">(cash on delivery)</span></div></div>
    </article>`;
  }

  async function loadOrders() {
    orders = await M.api('/staff/orders?view=' + view);
    renderOrders();
  }
  function renderOrders() {
    content.innerHTML = orders.length
      ? orders.map(orderCard).join('')
      : `<div class="card empty"><div class="big">✅</div><h2>${view === 'open' ? 'No open orders' : 'Nothing here yet'}</h2><p class="muted">New orders appear here automatically.</p></div>`;
  }

  async function loadInventory() {
    const products = await M.api('/products');
    content.innerHTML = `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody>${products
        .map(
          (p) => `<tr><td>${M.esc(p.emoji)} ${M.esc(p.name)} <span class="muted">${M.esc(p.detail)}</span></td><td>${M.esc(p.category)}</td><td>${M.money(p.price)}</td>
          <td><input type="number" min="0" max="100000" value="${p.stock}" id="stock-${p.id}" aria-label="Stock for ${M.esc(p.name)}" /></td>
          <td><button class="btn small" data-save="${p.id}">Save</button></td></tr>`
        )
        .join('')}</tbody></table></div></div>`;
  }

  async function show() {
    try {
      if (view === 'inventory') await loadInventory();
      else await loadOrders();
    } catch (err) {
      content.innerHTML = `<div class="error">${M.esc(err.message)}</div>`;
    }
  }

  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('[data-view]');
    if (!t) return;
    view = t.dataset.view;
    tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === t));
    show();
  });

  content.addEventListener('click', async (e) => {
    const save = e.target.closest('[data-save]');
    if (save) {
      const id = save.dataset.save;
      try {
        await M.api(`/staff/products/${id}/stock`, { method: 'POST', body: { stock: Number(document.getElementById('stock-' + id).value) } });
        M.toast('Stock saved');
      } catch (err) { M.toast(err.message, true); }
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act, o, i } = b.dataset;
    b.disabled = true;
    try {
      const path = act === 'complete' ? `/staff/orders/${o}/complete` : `/staff/orders/${o}/items/${i}/${act}`;
      const data = await M.api(path, { method: 'POST' });
      const idx = orders.findIndex((x) => x.id === o);
      if (idx >= 0) orders[idx] = data.order;
      if (act === 'complete') {
        M.toast('Order completed');
        orders = orders.filter((x) => x.id !== o); // it now lives under "Completed"
      } else if (data.message) {
        M.toast(data.message);
      }
      renderOrders();
    } catch (err) {
      M.toast(err.message, true);
      b.disabled = false;
    }
  });

  await show();
  // New orders arrive automatically (checks every 10 seconds)
  setInterval(() => { if (view === 'open' && document.visibilityState === 'visible') show(); }, 10000);
})();
