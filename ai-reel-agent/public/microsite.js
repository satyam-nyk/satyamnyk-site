function fmt(n) {
  if (n === null || n === undefined) return '--';
  return Number(n).toLocaleString();
}

function syncLoginLinks() {
  document.querySelectorAll('[data-login-link]').forEach((a) => {
    a.href = 'dashboard.html';
  });
}

async function loadPublicStats() {
  const postEl = document.getElementById('k-posts');
  const viewsEl = document.getElementById('k-views');
  const engEl = document.getElementById('k-eng');
  const methodEl = document.getElementById('k-method');

  postEl.textContent = '...';
  viewsEl.textContent = '...';
  engEl.textContent = '...';
  methodEl.textContent = '...';

  try {
    const statsRes = await fetch(`dashboard-data.json?t=${Date.now()}`);
    const data = await statsRes.json();
    if (!statsRes.ok || !data.success) throw new Error('stats unavailable');

    postEl.textContent = fmt(data.stats?.totalPosts || 0);
    viewsEl.textContent = fmt(data.stats?.totalViews || 0);
    engEl.textContent = `${data.stats?.avgEngagementRate || 0}%`;
    methodEl.textContent = data.insights?.methodSplit?.[0]?.method || '--';
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
