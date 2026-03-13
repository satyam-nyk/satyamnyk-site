function fmt(n) {
  if (n === null || n === undefined) return '--';
  return Number(n).toLocaleString();
}

function getApiBase() {
  const qs = new URLSearchParams(window.location.search);
  const fromQuery = qs.get('api');
  if (fromQuery) {
    localStorage.setItem('reel-api-base', fromQuery.replace(/\/$/, ''));
    return fromQuery.replace(/\/$/, '');
  }

  const saved = localStorage.getItem('reel-api-base');
  if (saved) return saved.replace(/\/$/, '');
  return window.location.origin;
}

function setupApiConfig() {
  const input = document.getElementById('api-base');
  const save = document.getElementById('save-api');
  if (!input || !save) return;

  input.value = getApiBase();
  syncLoginLinks(input.value);
  save.addEventListener('click', () => {
    const v = input.value.trim().replace(/\/$/, '');
    if (!v) return;
    localStorage.setItem('reel-api-base', v);
    syncLoginLinks(v);
    save.textContent = 'Saved';
    setTimeout(() => {
      save.textContent = 'Save Endpoint';
    }, 900);
    loadPublicStats();
  });
}

function syncLoginLinks(apiBase) {
  const clean = (apiBase || '').trim().replace(/\/$/, '');
  if (!clean) return;
  document.querySelectorAll('[data-login-link]').forEach((a) => {
    a.href = `dashboard-login.html?api=${encodeURIComponent(clean)}`;
  });
}

async function loadPublicStats() {
  const apiBase = getApiBase();
  const postEl = document.getElementById('k-posts');
  const viewsEl = document.getElementById('k-views');
  const engEl = document.getElementById('k-eng');
  const methodEl = document.getElementById('k-method');

  postEl.textContent = '...';
  viewsEl.textContent = '...';
  engEl.textContent = '...';
  methodEl.textContent = '...';

  try {
    const res = await fetch(`${apiBase}/api/health`);
    await res.json();
  } catch (_) {
    // health endpoint not essential for this public page
  }

  try {
    const statsRes = await fetch(`${apiBase}/dashboard-public-stats`);
    const data = await statsRes.json();
    if (!statsRes.ok || !data.success) throw new Error('stats unavailable');

    postEl.textContent = fmt(data.data.totalPosts);
    viewsEl.textContent = fmt(data.data.totalViews);
    engEl.textContent = `${data.data.avgEngagementRate || 0}%`;
    methodEl.textContent = data.data.topMethod || '--';
  } catch (e) {
    console.error('public stats error', e);
    postEl.textContent = '--';
    viewsEl.textContent = '--';
    engEl.textContent = '--';
    methodEl.textContent = '--';
  }
}

setupApiConfig();
loadPublicStats();
