(async function () {
  const ctx = await M.init('cart');
  if (!ctx) return;
  const user = ctx.user;

  const $ = (id) => document.getElementById(id);
  const itemsBox = $('items');
  let products = new Map();
  const subsCache = new Map(); // productId -> list of backup products

  function lines() {
    // keep only products that still exist
    return M.cart.get().filter((c) => products.has(c.productId));
  }

  async function loadSubs(productId) {
    if (subsCache.has(productId)) return;
    try { subsCache.set(productId, await M.api(`/products/${productId}/substitutes`)); } catch (e) { subsCache.set(productId, []); }
  }

  function render() {
    const stored = M.cart.get();
    const cart = stored.filter((c) => products.has(c.productId));
    let changed = cart.length !== stored.length;
    cart.forEach((c) => {
      const subs = subsCache.get(c.productId) || [];
      if (c.substituteId && !subs.some((s) => s.id === c.substituteId)) { c.substituteId = null; changed = true; }
    });
    if (changed) M.cart.set(cart); // save the cleaned basket
    $('empty').hidden = cart.length > 0;
    $('layout').hidden = cart.length === 0;
    if (!cart.length) return;

    let total = 0;
    itemsBox.innerHTML = cart
      .map((c) => {
        const p = products.get(c.productId);
        total += p.price * c.qty;
        const subs = subsCache.get(c.productId) || [];
        const options =
          `<option value="">Remove it from my bill (refund)</option>` +
          subs
            .map((s) => {
              const save = p.price - s.price;
              return `<option value="${s.id}" ${c.substituteId === s.id ? 'selected' : ''}>${M.esc(s.name)} · ${M.esc(s.detail)} · ${M.money(s.price)}${save > 0 ? ' (save ' + M.money(save) + ')' : ''}</option>`;
            })
            .join('');
        return `<div class="cart-row">
          <div class="pic">${M.esc(p.emoji)}</div>
          <div>
            <h3>${M.esc(p.name)}</h3>
            <div class="muted" style="font-size:13px">${M.esc(p.detail)} · ${M.money(p.price)} each</div>
            <div class="backup">
              <label for="sub-${p.id}">If this runs out, use:</label>
              <select id="sub-${p.id}" data-sub="${p.id}">${options}</select>
            </div>
          </div>
          <div style="text-align:right">
            <div class="qty"><button data-dec="${p.id}" aria-label="Less">−</button><span>${c.qty}</span><button data-inc="${p.id}" aria-label="More">+</button></div>
            <div class="price" style="margin-top:8px">${M.money(p.price * c.qty)}</div>
            <button class="link-btn" data-remove="${p.id}">Remove</button>
          </div>
        </div>`;
      })
      .join('');
    $('sum-items').textContent = M.money(total);
    $('sum-total').textContent = M.money(total);
  }

  function update(productId, fn) {
    const list = M.cart.get();
    const item = list.find((x) => x.productId === productId);
    if (!item) return;
    fn(item);
    M.cart.set(list.filter((x) => x.qty > 0));
    render();
  }

  itemsBox.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.inc) update(t.dataset.inc, (i) => { i.qty = Math.min(10, i.qty + 1); });
    if (t.dataset.dec) update(t.dataset.dec, (i) => { i.qty -= 1; });
    if (t.dataset.remove) update(t.dataset.remove, (i) => { i.qty = 0; });
  });
  itemsBox.addEventListener('change', (e) => {
    const s = e.target.closest('select[data-sub]');
    if (!s) return;
    update(s.dataset.sub, (i) => { i.substituteId = s.value || null; });
    M.toast('Backup choice saved');
  });

  // ---- Place order ----
  const form = $('order-form');
  const errBox = $('form-error');
  if (user) {
    $('f-name').value = user.name;
  } else {
    $('login-hint').hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    if (!user) {
      location.href = '/login.html?next=' + encodeURIComponent('/cart.html');
      return;
    }
    const btn = $('place-btn');
    btn.disabled = true;
    btn.textContent = 'Placing order...';
    try {
      const body = {
        items: lines().map((c) => ({ productId: c.productId, qty: c.qty, substituteId: c.substituteId || null })),
        address: {
          name: $('f-name').value,
          phone: $('f-phone').value,
          line1: $('f-line1').value,
          city: $('f-city').value,
          pincode: $('f-pin').value,
        },
        paymentMethod: 'cod',
      };
      const data = await M.api('/orders', { method: 'POST', body });
      M.cart.clear();
      location.href = '/orders.html?placed=' + encodeURIComponent(data.order.orderNumber);
    } catch (err) {
      if (err.status === 401) { location.href = '/login.html?next=' + encodeURIComponent('/cart.html'); return; }
      errBox.textContent = err.message;
      errBox.hidden = false;
      errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.disabled = false;
      btn.textContent = 'Place order';
    }
  });

  try {
    const list = await M.api('/products');
    products = new Map(list.map((p) => [p.id, p]));
    await Promise.all(M.cart.get().map((c) => loadSubs(c.productId)));
  } catch (err) {
    M.toast(err.message, true);
  }
  render();
})();
