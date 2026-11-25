(async function () {
  const ctx = await M.init('analytics', { roles: ['staff'] });
  if (!ctx) return;
  const box = document.getElementById('content');
  const pct = (v) => (v == null ? '–' : v + '%');

  try {
    const s = await M.api('/staff/stats');
    const max = Math.max(1, ...s.last7.map((d) => d.count));
    const bars = s.last7
      .map((d) => {
        const label = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
        return `<div class="bar"><b>${d.count}</b><i style="height:${Math.round((d.count / max) * 100)}%"></i><small>${M.esc(label)}</small></div>`;
      })
      .join('');
    box.innerHTML = `
      <div class="stats">
        <div class="stat"><span>Completed orders</span><strong>${s.completedOrders}</strong><small>${s.byStatus.placed + s.byStatus.packing} open now · ${s.byStatus.cancelled} cancelled</small></div>
        <div class="stat"><span>Revenue (cash on delivery)</span><strong>${M.money(s.revenue)}</strong><small>Average order ${s.avgOrderValue == null ? '–' : M.money(s.avgOrderValue)}</small></div>
        <div class="stat"><span>Item fill rate</span><strong>${pct(s.itemFillRate)}</strong><small>Items delivered (original or backup)</small></div>
        <div class="stat"><span>Complete baskets</span><strong>${pct(s.completeBasketRate)}</strong><small>Orders with nothing refunded</small></div>
        <div class="stat"><span>Stockouts saved by backups</span><strong>${pct(s.stockoutRecoveredRate)}</strong><small>${s.stockoutItems} item(s) went out of stock</small></div>
        <div class="stat"><span>Refund rate</span><strong>${pct(s.refundRate)}</strong><small>Orders hit by a stockout: ${pct(s.ordersWithStockoutRate)}</small></div>
      </div>
      <div class="card"><h2 style="font-size:18px">Orders in the last 7 days</h2><div class="bars">${bars}</div></div>
      <p class="muted" style="font-size:13px;margin-top:16px">All numbers come from real orders in your database. They stay empty until customers place and you complete orders.</p>`;
  } catch (err) {
    box.innerHTML = `<div class="error">${M.esc(err.message)}</div>`;
  }
})();
