(async function () {
  const ctx = await M.init('');
  if (!ctx) return;
  if (ctx.user) { location.replace(ctx.user.role === 'staff' ? '/packer.html' : M.safeNext() || '/'); return; }

  const form = document.getElementById('auth-form');
  const errBox = document.getElementById('form-error');
  const btn = document.getElementById('submit-btn');
  const mode = form.dataset.mode;
  const next = M.safeNext();

  // keep the "next" page when switching between login and signup
  const sw = document.getElementById('switch-link');
  if (next && sw) sw.href += '?next=' + encodeURIComponent(next);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Please wait...';
    try {
      const body = { email: document.getElementById('email').value, password: document.getElementById('password').value };
      if (mode === 'signup') {
        body.name = document.getElementById('name').value;
        body.phone = document.getElementById('phone').value;
      }
      const data = await M.api('/auth/' + mode, { method: 'POST', body });
      location.href = data.user.role === 'staff' ? '/packer.html' : next || '/';
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    }
  });
})();
