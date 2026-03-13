function fmt(n) {
  if (n === null || n === undefined) return '--';
  return Number(n).toLocaleString();
}

async function loadPublicStats() {
  try {
    const res = await fetch('/api/health');
    await res.json();
  } catch (_) {
    // health endpoint not essential for this public page
  }

  try {
    const statsRes = await fetch('/dashboard-public-stats');
    const data = await statsRes.json();
    if (!statsRes.ok || !data.success) return;

    document.getElementById('k-posts').textContent = fmt(data.data.totalPosts);
    document.getElementById('k-views').textContent = fmt(data.data.totalViews);
    document.getElementById('k-eng').textContent = `${data.data.avgEngagementRate || 0}%`;
    document.getElementById('k-method').textContent = data.data.topMethod || '--';
  } catch (e) {
    console.error('public stats error', e);
  }
}

loadPublicStats();
