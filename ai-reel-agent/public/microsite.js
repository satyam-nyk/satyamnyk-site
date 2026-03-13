function fmt(n) {
  if (n === null || n === undefined) return '--';
  return Number(n).toLocaleString();
}

function syncLoginLinks() {
  const apiBase = window.location.origin;
  document.querySelectorAll('[data-login-link]').forEach((a) => {
    a.href = `${apiBase}/ai-reel-agent/public/dashboard-login.html`;
  });
}

async function loadPublicStats() {
  const apiBase = window.location.origin;
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

syncLoginLinks();
loadPublicStats();
