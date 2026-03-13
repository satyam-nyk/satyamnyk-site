function fmt(n) {
  if (n === null || n === undefined) return '--';
  return Number(n).toLocaleString();
}

function syncLoginLinks() {
  document.querySelectorAll('[data-login-link]').forEach((a) => {
    a.href = 'dashboard-login.php?autologin=1';
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
    const statsRes = await fetch('dashboard-public-stats.php');
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
