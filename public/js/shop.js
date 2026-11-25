(async function () {
  const ctx = await M.init('shop');
  if (!ctx) return;

  const grid = document.getElementById('grid');
  const chips = document.getElementById('chips');
  const search = document.getElementById('search');
  let products = [];
  let category = 'All';
  let query = '';

  function renderChips() {
    const cats = ['All'].concat([...new Set(products.map((p) => p.category))]);
    chips.innerHTML = cats
      .map((c) => `<button class="chip ${c === category ? 'active' : ''}" data-cat="${M.esc(c)}">${M.esc(c)}</button>`)
      .join('');
  }

  function renderGrid() {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => (category === 'All' || p.category === category) && (!q || p.name.toLowerCase().includes(q)));
    if (!list.length) { grid.innerHTML = '<div class="muted">No items found.</div>'; return; }
    grid.innerHTML = list
      .map((p) => {
        const out = p.stock <= 0;
        const tag = out ? '<span class="tag out">Out of stock</span>' : p.stock <= 5 ? `<span class="tag low">Only ${p.stock} left</span>` : '';
        return `<article class="product">
          <div class="pic">${M.esc(p.emoji)}</div>
          <h3>${M.esc(p.name)}</h3>
          <div class="detail">${M.esc(p.detail)} · ${M.esc(p.category)} ${tag}</div>
          <div class="foot"><span class="price">${M.money(p.price)}</span>
          <button class="btn primary small" data-add="${p.id}" ${out ? 'disabled' : ''}>+ Add</button></div>
        </article>`;
      })
      .join('');
  }

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    category = b.dataset.cat;
    renderChips();
    renderGrid();
  });
  search.addEventListener('input', () => { query = search.value; renderGrid(); });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    M.cart.add(b.dataset.add);
    const p = products.find((x) => x.id === b.dataset.add);
    M.toast(`${p ? p.name : 'Item'} added to your basket`);
  });

  try {
    products = await M.api('/products');
    renderChips();
    renderGrid();
  } catch (err) {
    grid.innerHTML = `<div class="error">${M.esc(err.message)}</div>`;
  }
})();
