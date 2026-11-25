(async function () {
  const ctx = await M.init('orders', { roles: ['customer'] });
  if (!ctx) return;

  const list = document.getElementById('list');
  const placed = new URLSearchParams(location.search).get('placed');
  if (placed) {
    const n = document.getElementById('placed-note');
    n.textContent = `Order ${placed} placed! We will start packing it shortly.`;
    n.hidden = false;
  }

  const STATUS = { placed: 'Order placed', packing: 'Being packed', completed: 'Completed', cancelled: 'Cancelled' };

  function outcome(i) {
    if (i.status === 'packed') return '<span class="ok">Packed ✓</span>';
    if (i.status === 'substituted') return `<span class="swap">Replaced with ${M.esc(i.backup.name)} (${M.money(i.backup.unitPrice)}) as you chose</span>`;
    if (i.status === 'refunded') return '<span class="gone">Unavailable · removed from your bill as you chose</span>';
    return i.backup
      ? `<span class="small">Waiting to be packed · backup: ${M.esc(i.backup.name)}</span>`
      : '<span class="small">Waiting to be packed · refund if unavailable</span>';
  }

  function card(o) {
    const done = o.status === 'completed';
    const lines = o.items
      .map(
        (i) => `<div class="line"><div class="pic">${M.esc(i.emoji)}</div>
          <div class="grow"><strong>${M.esc(i.name)}</strong> <span class="small">× ${i.qty}</span><div>${outcome(i)}</div></div>
          <div><strong>${M.money(i.lineTotal)}</strong></div></div>`
      )
      .join('');
    const cancel = o.status === 'placed' ? `<button class="btn danger small" data-cancel="${o.id}">Cancel order</button>` : '<span></span>';
    const totalLabel = done ? 'Final total (pay on delivery)' : o.status === 'cancelled' ? 'Total' : 'Estimated total';
    const back = done && o.moneyBack > 0 ? `<div class="small ok">You saved ${M.money(o.moneyBack)} because of unavailable items.</div>` : '';
    return `<article class="order">
      <div class="order-head">
        <div><h3>Order ${M.esc(o.orderNumber)}</h3><div class="muted" style="font-size:13px">${M.date(o.createdAt)} · Deliver to ${M.esc(o.address.line1)}, ${M.esc(o.address.city)} ${M.esc(o.address.pincode)}</div></div>
        <span class="status ${o.status}">${STATUS[o.status] || o.status}</span>
      </div>
      ${lines}
      <div class="order-foot">${cancel}<div style="text-align:right">${back}<div>${totalLabel}: <span class="price">${M.money(o.status === 'cancelled' ? o.estimatedTotal : o.finalTotal)}</span></div></div></div>
    </article>`;
  }

  async function load() {
    try {
      const orders = await M.api('/orders/mine');
      list.innerHTML = orders.length
        ? orders.map(card).join('')
        : '<div class="card empty"><div class="big">📦</div><h2>No orders yet</h2><p>Your orders will show up here.</p><a class="btn primary" href="/">Start shopping</a></div>';
    } catch (err) {
      list.innerHTML = `<div class="error">${M.esc(err.message)}</div>`;
    }
  }

  list.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cancel]');
    if (!b) return;
    if (!confirm('Cancel this order?')) return;
    try {
      await M.api(`/orders/${b.dataset.cancel}/cancel`, { method: 'POST' });
      M.toast('Order cancelled');
      load();
    } catch (err) {
      M.toast(err.message, true);
    }
  });

  await load();
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000); // refresh every 15 seconds
})();
