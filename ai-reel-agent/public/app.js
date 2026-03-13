const API_BASE_URL = '/dashboard/api/dashboard-data';
const REFRESH_INTERVAL = 30000;

let engagementChart = null;
let methodChart = null;
let updateTimeout = null;
let currentOffset = 0;
let currentLimit = 20;
let currentTotal = 0;

async function ensureSession() {
  const response = await fetch('/dashboard/api/auth/session');
  if (!response.ok) {
    window.location.href = '/dashboard/login';
    return false;
  }
  return true;
}

async function initDashboard() {
  const active = await ensureSession();
  if (!active) return;

  await updateDashboard();
  await reloadHistory();

  if (updateTimeout) clearInterval(updateTimeout);
  updateTimeout = setInterval(async () => {
    await updateDashboard();
  }, REFRESH_INTERVAL);
}

async function updateDashboard() {
  try {
    const response = await fetch(API_BASE_URL);
    if (response.status === 401) {
      window.location.href = '/dashboard/login';
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');

    updateUI(data);
    updateTime();
  } catch (error) {
    console.error('[Dashboard] Error updating:', error);
    showToast('Failed to update dashboard', 'error');
  }
}

function updateUI(data) {
  updateTodaySection(data.today);
  updateAPIUsage(data.apiUsage);
  updateStatistics(data.stats, data.insights);
  updateQueue(data.queue);
  updateCache(data.cache);
  updateEngagementChart(data.analytics);
  updateTrendingTopics(data.insights?.topTopics || data.trendingTopics || []);
  updateMethodChart(data.insights?.methodSplit || []);
  updateRecommendations(data.recommendations || null);
}

function hourTo12h(hourStr) {
  if (hourStr === null || hourStr === undefined) return '--';
  const h = Number(hourStr);
  if (Number.isNaN(h)) return '--';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

function weekdayName(dayStr) {
  const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const i = Number(dayStr);
  return Number.isNaN(i) ? '--' : (map[i] || '--');
}

function updateRecommendations(data) {
  if (!data) return;

  const bestHour = data.bestHour;
  const bestDay = data.bestDay;
  const cadence = data.cadence || {};

  const bestHourEl = document.getElementById('best-hour');
  const bestHourMeta = document.getElementById('best-hour-meta');
  if (bestHourEl) bestHourEl.textContent = bestHour ? hourTo12h(bestHour.hour) : '--';
  if (bestHourMeta) {
    bestHourMeta.textContent = bestHour
      ? `avg eng ${Number(bestHour.avg_engagement || 0).toFixed(2)}% • ${bestHour.posts || 0} posts`
      : 'Not enough data';
  }

  const bestDayEl = document.getElementById('best-day');
  const bestDayMeta = document.getElementById('best-day-meta');
  if (bestDayEl) bestDayEl.textContent = bestDay ? weekdayName(bestDay.day) : '--';
  if (bestDayMeta) {
    bestDayMeta.textContent = bestDay
      ? `avg eng ${Number(bestDay.avg_engagement || 0).toFixed(2)}% • ${bestDay.posts || 0} posts`
      : 'Not enough data';
  }

  const cadencePosts = document.getElementById('cadence-posts');
  const cadenceMeta = document.getElementById('cadence-meta');
  if (cadencePosts) cadencePosts.textContent = `${cadence.posts_last_7 || 0} posts`;
  if (cadenceMeta) {
    cadenceMeta.textContent = `avg views ${formatNumber(cadence.avg_views_last_7 || 0)} • avg eng ${Number(cadence.avg_engagement_last_7 || 0).toFixed(2)}%`;
  }

  const momentum = document.getElementById('momentum-topics');
  if (!momentum) return;
  const rows = data.momentumTopics || [];
  if (!rows.length) {
    momentum.innerHTML = '<p class="loading">No momentum topics yet.</p>';
    return;
  }

  momentum.innerHTML = rows.map((row, idx) => {
    const score = Number(row.momentum_score || 0).toFixed(2);
    const recent = formatNumber(row.recent_avg_views || 0);
    const previous = formatNumber(row.previous_avg_views || 0);
    return `
      <div class="recommend-item">
        <span class="recommend-rank">#${idx + 1}</span>
        <div class="recommend-topic-wrap">
          <span class="recommend-topic">${escapeHtml(row.topic || 'Unknown')}</span>
          <span class="recommend-topic-meta">momentum ${score}% • recent ${recent} vs prev ${previous}</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateTodaySection(today) {
  if (!today) return;

  const post = today.post;
  const statusBadge = document.getElementById('today-status');
  statusBadge.textContent = post?.status?.toUpperCase() || 'NOT STARTED';
  statusBadge.className = `status-badge ${post?.status || 'pending'}`;

  document.getElementById('today-topic').textContent = post?.topic || 'Waiting for generation...';
  document.getElementById('today-script').textContent = post?.script || 'Script will appear here';
  document.getElementById('today-generator').textContent = post?.generation_method || '--';
  document.getElementById('today-post-id').textContent = post?.instagram_post_id || '--';

  const postedEl = document.getElementById('today-posted');
  postedEl.textContent = post?.posted_at ? new Date(post.posted_at).toLocaleTimeString() : '--';
}

function updateAPIUsage(apiUsage) {
  if (!apiUsage) return;
  updateAPIBar('gemini', apiUsage.gemini);
  updateAPIBar('heygen', apiUsage.heygen);
  updateAPIBar('instagram', apiUsage.instagram);
}

function updateAPIBar(service, data) {
  const denominator = data.limit || data.total || 1;
  const percentUsed = Math.round((data.used / denominator) * 100) || 0;

  const progressEl = document.getElementById(`${service}-progress`);
  if (progressEl) progressEl.style.width = `${percentUsed}%`;

  document.getElementById(`${service}-used`).textContent = data.used;
  document.getElementById(`${service}-limit`).textContent = denominator;

  const statusEl = document.getElementById(`${service}-status`);
  statusEl.className = 'status-light';
  if (percentUsed >= 80) statusEl.classList.add('danger');
  else if (percentUsed >= 60) statusEl.classList.add('warning');
  else statusEl.classList.add('healthy');
}

function updateStatistics(stats, insights) {
  if (!stats) return;
  document.getElementById('total-posts').textContent = formatNumber(stats.totalPosts);
  document.getElementById('total-views').textContent = formatNumber(stats.totalViews);
  document.getElementById('avg-engagement').textContent = `${(stats.avgEngagementRate || 0).toFixed(2)}%`;

  const posted = insights?.kpi?.posted_count || 0;
  const failed = insights?.kpi?.failed_count || 0;
  document.getElementById('posted-failed').textContent = `${posted} / ${failed}`;
}

function updateQueue(queue) {
  if (!queue) return;
  const pending = queue.pending || 0;
  const posted = queue.posted || 0;
  const total = pending + posted;
  const percent = total > 0 ? Math.round((posted / total) * 100) : 0;

  document.getElementById('queue-pending').textContent = pending;
  document.getElementById('queue-posted').textContent = posted;
  document.getElementById('queue-percent').textContent = `${percent}%`;
  document.getElementById('queue-progress').style.width = `${percent}%`;
}

function updateCache(cache) {
  if (!cache) return;
  document.getElementById('cache-total').textContent = cache.totalCached;
  document.getElementById('cache-reuses').textContent = cache.totalReuses;
  document.getElementById('cache-avg').textContent = (cache.avgReuses || 0).toFixed(1);
}

function updateEngagementChart(analytics) {
  if (!analytics || analytics.length === 0) return;

  const labels = analytics.map((a) => formatDate(a.date)).reverse();
  const views = analytics.map((a) => a.totalViews).reverse();
  const likes = analytics.map((a) => a.totalLikes).reverse();
  const comments = analytics.map((a) => a.totalComments).reverse();

  const ctx = document.getElementById('engagementChart');
  if (!ctx) return;
  if (engagementChart) engagementChart.destroy();

  engagementChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Views',
          data: views,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Likes',
          data: likes,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Comments',
          data: comments,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#cbd5e1' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
      },
    },
  });
}

function updateMethodChart(split) {
  const ctx = document.getElementById('methodChart');
  if (!ctx) return;
  if (methodChart) methodChart.destroy();

  const labels = split.map((s) => s.method || 'unknown');
  const values = split.map((s) => s.count || 0);

  methodChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'],
      }],
    },
    options: {
      plugins: { legend: { labels: { color: '#cbd5e1' } } },
    },
  });
}

function updateTrendingTopics(topics) {
  const container = document.getElementById('trending-topics');
  if (!container) return;
  if (!topics || topics.length === 0) {
    container.innerHTML = '<p class="loading">No trending topics yet</p>';
    return;
  }

  container.innerHTML = topics.map((topic, index) => `
    <div class="trending-item">
      <div><span class="topic-name">#${index + 1} ${escapeHtml(topic.topic || 'Unknown')}</span></div>
      <div class="topic-stats">
        <span title="Post Count">📊 ${topic.posts || topic.usage_count || 0}</span>
        <span title="Average Views">👁️ ${formatNumber(topic.avg_views || 0)}</span>
        <span title="Avg Engagement">💬 ${(topic.avg_engagement_rate || 0).toFixed(2)}%</span>
      </div>
    </div>
  `).join('');
}

async function reloadHistory() {
  currentOffset = 0;
  await loadHistory();
}

async function loadHistory() {
  const status = document.getElementById('status-filter')?.value || 'all';
  const url = `${API_BASE_URL}/posts?limit=${currentLimit}&offset=${currentOffset}&status=${encodeURIComponent(status)}`;

  try {
    const response = await fetch(url);
    if (response.status === 401) {
      window.location.href = '/dashboard/login';
      return;
    }

    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load history');

    const rows = payload.data || [];
    currentTotal = payload.pagination?.total || 0;
    renderHistory(rows);

    const page = Math.floor(currentOffset / currentLimit) + 1;
    const pages = Math.max(1, Math.ceil(currentTotal / currentLimit));
    document.getElementById('page-indicator').textContent = `Page ${page} of ${pages}`;
  } catch (error) {
    console.error('[Dashboard] History error:', error);
    showToast('Failed to load post history', 'error');
  }
}

function renderHistory(rows) {
  const body = document.getElementById('history-body');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7">No posts found.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((row) => `
    <tr onclick="showPostDetail(${row.id})">
      <td>${formatDate(row.date)}</td>
      <td>${escapeHtml((row.topic || '--').slice(0, 56))}</td>
      <td><span class="table-status ${row.status || 'pending'}">${(row.status || 'pending').toUpperCase()}</span></td>
      <td>${formatNumber(row.views || 0)}</td>
      <td>${formatNumber(row.likes || 0)}</td>
      <td>${formatNumber(row.comments || 0)}</td>
      <td>${(row.engagement_rate || 0).toFixed(2)}%</td>
    </tr>
  `).join('');
}

async function showPostDetail(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/posts/${id}`);
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load post detail');

    const p = payload.data;
    const detail = document.getElementById('post-detail');
    detail.innerHTML = `
      <h3>${escapeHtml(p.topic || 'Untitled')}</h3>
      <p><strong>Date:</strong> ${formatDate(p.date)}</p>
      <p><strong>Status:</strong> ${(p.status || 'pending').toUpperCase()}</p>
      <p><strong>Method:</strong> ${escapeHtml(p.generation_method || '--')}</p>
      <p><strong>Instagram Post ID:</strong> ${escapeHtml(p.instagram_post_id || '--')}</p>
      <p><strong>Views:</strong> ${formatNumber(p.views || 0)} | <strong>Likes:</strong> ${formatNumber(p.likes || 0)}</p>
      <p><strong>Comments:</strong> ${formatNumber(p.comments || 0)} | <strong>Shares:</strong> ${formatNumber(p.shares || 0)}</p>
      <p><strong>Engagement:</strong> ${(p.engagement_rate || 0).toFixed(2)}%</p>
      <h4>Script</h4>
      <div class="detail-script">${escapeHtml(p.script || '--')}</div>
    `;
  } catch (error) {
    console.error('[Dashboard] Detail error:', error);
    showToast('Failed to load selected post detail', 'error');
  }
}

function prevPage() {
  if (currentOffset <= 0) return;
  currentOffset = Math.max(0, currentOffset - currentLimit);
  loadHistory();
}

function nextPage() {
  if (currentOffset + currentLimit >= currentTotal) return;
  currentOffset += currentLimit;
  loadHistory();
}

async function triggerManualPost() {
  const btn = document.getElementById('manual-post-btn');
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = 'Posting...';

    const response = await fetch('/api/webhook/manual-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getWebhookSecret()}`,
      },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to post');

    showToast('Manual post triggered', 'success');
    await updateDashboard();
    await loadHistory();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function logoutDashboard() {
  await fetch('/dashboard/api/auth/logout', { method: 'POST' });
  window.location.href = '/dashboard/login';
}

function getWebhookSecret() {
  return localStorage.getItem('webhook-secret') || '';
}

function formatNumber(num) {
  if (!num) return '0';
  return Math.round(num).toLocaleString();
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateTime() {
  const now = new Date();
  document.getElementById('updated-time').textContent = now.toLocaleTimeString();
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.addEventListener('beforeunload', () => {
  if (updateTimeout) clearInterval(updateTimeout);
  if (engagementChart) engagementChart.destroy();
  if (methodChart) methodChart.destroy();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (updateTimeout) clearInterval(updateTimeout);
  } else {
    updateDashboard();
    updateTimeout = setInterval(updateDashboard, REFRESH_INTERVAL);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
