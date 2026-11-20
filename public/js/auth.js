// Auth page logic
document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect to feed
  if (localStorage.getItem('token')) {
    window.location.href = '/feed.html';
    return;
  }

  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
  });

  registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/feed.html';
    } catch (err) {
      errorEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/feed.html';
    } catch (err) {
      errorEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
});
