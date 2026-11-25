// Shared helpers used by every page. Exposes one global object: M
(function () {
  const CART_KEY = 'minutly-cart-v2';
  const M = (window.M = {});

  // Escape text before putting it into HTML (stops script injection)
  M.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  M.money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  M.date = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  // Talk to the backend
  M.api = async function (path, opts) {
    opts = opts || {};
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Something went wrong. Please try again.');
      err.status = res.status;
      throw err;
    }
    return data;
  };

  let toastTimer;
  M.toast = function (msg, bad) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, 3200);
  };

  // Basket is kept in the browser until the order is placed
  M.cart = {
    get() {
      try { const a = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    },
    set(list) { localStorage.setItem(CART_KEY, JSON.stringify(list)); M.refreshCartBadge(); },
    add(productId) {
      const list = M.cart.get();
      const found = list.find((x) => x.productId === productId);
      if (found) found.qty = Math.min(10, found.qty + 1);
      else list.push({ productId, qty: 1, substituteId: null });
      M.cart.set(list);
    },
    count() { return M.cart.get().reduce((s, x) => s + x.qty, 0); },
    clear() { M.cart.set([]); },
  };

  M.refreshCartBadge = function () {
    const b = document.getElementById('cart-badge');
    if (!b) return;
    const n = M.cart.count();
    b.textContent = n;
    b.hidden = n === 0;
  };

  M.safeNext = function () {
    const n = new URLSearchParams(location.search).get('next');
    return n && n.startsWith('/') && !n.startsWith('//') ? n : null;
  };

  // Draws the top bar, checks login, and (optionally) blocks pages by role.
  // Returns { user } or null when it had to redirect.
  M.init = async function (active, opts) {
    opts = opts || {};
    let user = null;
    try { user = (await M.api('/auth/me')).user; } catch (e) { /* offline */ }

    if (opts.roles) {
      if (!user) { location.replace('/login.html?next=' + encodeURIComponent(location.pathname)); return null; }
      if (!opts.roles.includes(user.role)) { location.replace('/'); return null; }
    }

    const nav = document.getElementById('nav');
    if (nav) {
      const staff = user && user.role === 'staff';
      const link = (key, href, text, extra) => `<a href="${href}" class="${active === key ? 'active' : ''}">${text}${extra || ''}</a>`;
      let links = link('shop', '/', 'Shop');
      if (!staff) links += link('cart', '/cart.html', 'Cart', '<span class="badge" id="cart-badge" hidden>0</span>');
      if (user && !staff) links += link('orders', '/orders.html', 'My orders');
      if (staff) links += link('packer', '/packer.html', 'Packer station') + link('analytics', '/analytics.html', 'Analytics');
      const next = encodeURIComponent(location.pathname + location.search);
      const right = user
        ? `<span class="hello">Hi, ${M.esc(user.name.split(' ')[0])}</span><button class="btn ghost small" id="logout-btn">Log out</button>`
        : `<a class="btn ghost small" href="/login.html?next=${next}">Log in</a><a class="btn primary small" href="/signup.html?next=${next}">Sign up</a>`;
      nav.className = 'topbar';
      nav.innerHTML = `<div class="nav-inner"><a class="brand" href="/"><span class="brand-mark">M</span>minutly</a><nav class="nav-links">${links}</nav><div class="nav-right">${right}</div></div>`;
      const out = document.getElementById('logout-btn');
      if (out) out.addEventListener('click', async () => { try { await M.api('/auth/logout', { method: 'POST' }); } catch (e) {} location.href = '/'; });
      M.refreshCartBadge();
    }
    return { user };
  };
})();
