const SNAPSHOT_URL = 'dashboard-data.json';
const PAGE_SIZE = 20;

let engagementChart = null;
let methodChart = null;
let snapshot = null;
let filteredHistory = [];
let currentOffset = 0;

function deriveTopicFromCaption(caption = '') {
  const text = String(caption || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Instagram Post';
  return text.length > 56 ? `${text.slice(0, 53)}...` : text;
}

function deriveTopicFromTitle(title = '') {
  const text = String(title || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'YouTube Video';
  return text.length > 56 ? `${text.slice(0, 53)}...` : text;
}

function getYouTubeVideoId(input) {
  if (!input) return null;
  const raw = String(input).trim();
  const idLike = /^[A-Za-z0-9_-]{11}$/;
  if (idLike.test(raw)) return raw;
  const watchMatch = raw.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const shortsMatch = raw.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  const embedMatch = raw.match(/\/embed\/([A-Za-z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}

function getUnifiedHistoryRows() {
  const dbRows = (snapshot?.history || []).map((row) => ({
    ...row,
    platform: row.youtube_video_id ? 'youtube' : (row.instagram_post_id ? 'instagram' : 'internal'),
    rowKey: `db_${row.id}`,
  }));

  const seenInstagramIds = new Set(
    dbRows
      .map((row) => String(row.instagram_post_id || '').trim())
      .filter(Boolean)
  );

  const instagramRows = (snapshot?.instagram?.recentMedia || [])
    .filter((item) => item?.id && !seenInstagramIds.has(String(item.id)))
    .map((item, index) => {
      const timestamp = item.timestamp || null;
      const dateOnly = timestamp ? String(timestamp).split('T')[0] : null;
      const likes = Number(item.likes || 0);
      const comments = Number(item.comments || 0);
      const views = Number(item.views || 0);
      const engagementRate = views > 0
        ? Number((((likes + comments) * 100) / views).toFixed(2))
        : 0;

      return {
        id: -(index + 1),
        rowKey: `ig_${item.id}`,
        date: dateOnly,
        topic: deriveTopicFromCaption(item.caption),
        script: item.caption || '--',
        video_id: null,
        instagram_post_id: item.id,
        permalink: item.permalink || null,
        views,
        likes,
        comments,
        shares: 0,
        status: 'posted',
        platform: 'instagram',
        generation_method: 'instagram-feed',
        posted_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        engagement_rate: engagementRate,
      };
    });

  const seenYoutubeIds = new Set(
    dbRows
      .map((row) => String(row.youtube_video_id || '').trim())
      .filter(Boolean)
  );

  const youtubeRows = (snapshot?.youtube?.recentVideos || [])
    .map((item, index) => {
      const id = getYouTubeVideoId(item?.id) || getYouTubeVideoId(item?.snippet?.resourceId?.videoId);
      if (!id || seenYoutubeIds.has(String(id))) return null;
      const stats = item.statistics || {};
      const views = Number(stats.viewCount || 0);
      const likes = Number(stats.likeCount || 0);
      const comments = Number(stats.commentCount || 0);
      const engagementRate = views > 0
        ? Number((((likes + comments) * 100) / views).toFixed(2))
        : 0;

      return {
        id: -(500 + index + 1),
        rowKey: `yt_${id}`,
        date: item?.snippet?.publishedAt ? String(item.snippet.publishedAt).split('T')[0] : null,
        topic: deriveTopicFromTitle(item?.snippet?.title),
        script: item?.snippet?.description || '--',
        video_id: null,
        instagram_post_id: null,
        permalink: `https://www.youtube.com/watch?v=${id}`,
        youtube_video_id: id,
        youtube_url: `https://www.youtube.com/watch?v=${id}`,
        youtube_views: views,
        youtube_likes: likes,
        youtube_comments: comments,
        views,
        likes,
        comments,
        shares: 0,
        status: 'posted',
        platform: 'youtube',
        generation_method: 'youtube-feed',
        posted_at: item?.snippet?.publishedAt || null,
        created_at: item?.snippet?.publishedAt || null,
        updated_at: item?.snippet?.publishedAt || null,
        engagement_rate: engagementRate,
      };
    })
    .filter(Boolean);

  return [...dbRows, ...instagramRows, ...youtubeRows].sort((a, b) => {
    const aTime = new Date(a.posted_at || a.updated_at || a.date || 0).getTime();
    const bTime = new Date(b.posted_at || b.updated_at || b.date || 0).getTime();
    return bTime - aTime;
  });
}

function snapshotUrl() {
  return `${SNAPSHOT_URL}?t=${Date.now()}`;
}

async function initDashboard() {
  await refreshSnapshot();
}

async function refreshSnapshot(showMessage = false) {
  try {
    const response = await fetch(snapshotUrl(), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Snapshot unavailable');

    snapshot = data;
    updateUI(data);
    currentOffset = 0;
    loadHistory();
    updateTime(data.generatedAt);

    if (showMessage) {
      showToast('Dashboard snapshot refreshed.', 'success');
    }
  } catch (error) {
    console.error('[Dashboard] Snapshot error:', error);
    showToast('Failed to load dashboard snapshot', 'error');
  }
}

function updateUI(data) {
  updateTodaySection(data.today);
  updateAPIUsage(data.apiUsage);
  updateStatistics(data.stats, data.insights);
  updateQueue(data.queue);
  updateCache(data.cache);
  updateEngagementChart(data.analytics || []);
  updateTrendingTopics(data.insights?.topTopics || data.trendingTopics || []);
  updateMethodChart(data.insights?.methodSplit || []);
  updateRecommendations(data.recommendations || null);
  updateYouTubeChannelCard(data.youtube || null);
  updateYouTubeWall(data.youtube?.recentVideos || [], data.history || []);
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
  const index = Number(dayStr);
  return Number.isNaN(index) ? '--' : (map[index] || '--');
}

function updateRecommendations(data) {
  if (!data) return;

  const bestHourEl = document.getElementById('best-hour');
  const bestHourMeta = document.getElementById('best-hour-meta');
  if (bestHourEl) bestHourEl.textContent = data.bestHour ? hourTo12h(data.bestHour.hour) : '--';
  if (bestHourMeta) {
    bestHourMeta.textContent = data.bestHour
      ? `avg eng ${Number(data.bestHour.avg_engagement || 0).toFixed(2)}% • ${data.bestHour.posts || 0} posts`
      : 'Not enough data';
  }

  const bestDayEl = document.getElementById('best-day');
  const bestDayMeta = document.getElementById('best-day-meta');
  if (bestDayEl) bestDayEl.textContent = data.bestDay ? weekdayName(data.bestDay.day) : '--';
  if (bestDayMeta) {
    bestDayMeta.textContent = data.bestDay
      ? `avg eng ${Number(data.bestDay.avg_engagement || 0).toFixed(2)}% • ${data.bestDay.posts || 0} posts`
      : 'Not enough data';
  }

  const cadencePosts = document.getElementById('cadence-posts');
  const cadenceMeta = document.getElementById('cadence-meta');
  if (cadencePosts) cadencePosts.textContent = `${data.cadence?.posts_last_7 || 0} posts`;
  if (cadenceMeta) {
    cadenceMeta.textContent = `avg views ${formatNumber(data.cadence?.avg_views_last_7 || 0)} • avg eng ${Number(data.cadence?.avg_engagement_last_7 || 0).toFixed(2)}%`;
  }

  const momentum = document.getElementById('momentum-topics');
  if (!momentum) return;
  const rows = data.momentumTopics || [];
  if (!rows.length) {
    momentum.innerHTML = '<p class="loading">No momentum topics yet.</p>';
    return;
  }

  momentum.innerHTML = rows.map((row, index) => `
    <div class="recommend-item">
      <span class="recommend-rank">#${index + 1}</span>
      <div class="recommend-topic-wrap">
        <span class="recommend-topic">${escapeHtml(row.topic || 'Unknown')}</span>
        <span class="recommend-topic-meta">momentum ${Number(row.momentum_score || 0).toFixed(2)}% • recent ${formatNumber(row.recent_avg_views || 0)} vs prev ${formatNumber(row.previous_avg_views || 0)}</span>
      </div>
    </div>
  `).join('');
}

function updateTodaySection(today) {
  const post = today?.post;
  const statusBadge = document.getElementById('today-status');
  if (statusBadge) {
    statusBadge.textContent = post?.status?.toUpperCase() || 'NOT STARTED';
    statusBadge.className = `status-badge ${post?.status || 'pending'}`;
  }

  document.getElementById('today-topic').textContent = post?.topic || 'Waiting for generation...';
  document.getElementById('today-script').textContent = post?.script || 'Run npm run dashboard:refresh to build the latest snapshot.';
  document.getElementById('today-generator').textContent = post?.generation_method || '--';
  document.getElementById('today-post-id').textContent = post?.instagram_post_id || '--';
  document.getElementById('today-posted').textContent = post?.posted_at
    ? new Date(post.posted_at).toLocaleTimeString()
    : '--';
}

function updateAPIUsage(apiUsage) {
  if (!apiUsage) return;
  updateAPIBar('gemini', apiUsage.gemini);
  updateAPIBar('heygen', apiUsage.heygen);
  updateAPIBar('instagram', apiUsage.instagram);
  updateAPIBar('youtube', apiUsage.youtube);
}

function updateAPIBar(service, data = {}) {
  const denominator = data.limit || data.total || 1;
  const percentUsed = denominator > 0 ? Math.round(((data.used || 0) / denominator) * 100) : 0;

  const progressEl = document.getElementById(`${service}-progress`);
  if (progressEl) progressEl.style.width = `${percentUsed}%`;

  const usedEl = document.getElementById(`${service}-used`);
  const limitEl = document.getElementById(`${service}-limit`);
  if (usedEl) usedEl.textContent = data.used || 0;
  if (limitEl) limitEl.textContent = denominator;

  const statusEl = document.getElementById(`${service}-status`);
  if (!statusEl) return;
  statusEl.className = 'status-light';
  if (percentUsed >= 80) statusEl.classList.add('danger');
  else if (percentUsed >= 60) statusEl.classList.add('warning');
  else statusEl.classList.add('healthy');
}

function updateYouTubeChannelCard(youtube) {
  const channel = youtube?.channel || null;
  const titleEl = document.getElementById('yt-channel-title');
  const urlEl = document.getElementById('yt-channel-url');
  const subsEl = document.getElementById('yt-stat-subs');
  const viewsEl = document.getElementById('yt-stat-views');
  const videosEl = document.getElementById('yt-stat-videos');
  const analyticsNote = document.getElementById('yt-analytics-note');

  if (!channel) {
    if (titleEl) titleEl.textContent = 'YouTube not connected';
    return;
  }

  const customUrl = channel.snippet?.customUrl
    ? `youtube.com/${channel.snippet.customUrl.replace(/^@/, '@')}`
    : (channel.id ? `youtube.com/channel/${channel.id}` : null);

  if (titleEl) titleEl.textContent = channel.snippet?.title || 'YouTube Channel';
  if (urlEl) urlEl.textContent = customUrl || channel.id || '';
  if (subsEl) subsEl.textContent = formatNumber(Number(channel.statistics?.subscriberCount || 0));
  if (viewsEl) viewsEl.textContent = formatNumber(Number(channel.statistics?.viewCount || 0));
  if (videosEl) videosEl.textContent = formatNumber(Number(channel.statistics?.videoCount || 0));

  // Show note if Analytics API failed
  if (analyticsNote && youtube?.analyticsEnabled === false) {
    analyticsNote.style.display = 'block';
  }
}

function updateYouTubeWall(youtubeVideos = [], historyRows = []) {
  const container = document.getElementById('youtube-wall');
  if (!container) return;

  const fromYoutube = (youtubeVideos || [])
    .map((item) => {
      const id = getYouTubeVideoId(item?.id) || getYouTubeVideoId(item?.snippet?.resourceId?.videoId);
      if (!id) return null;
      return {
        id,
        title: item?.snippet?.title || 'YouTube Video',
        views: Number(item?.statistics?.viewCount || 0),
        likes: Number(item?.statistics?.likeCount || 0),
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  const rows = fromYoutube.length
    ? fromYoutube
    : (historyRows || [])
      .filter((row) => row?.youtube_video_id)
      .map((row) => ({
        id: row.youtube_video_id,
        title: row.topic || 'YouTube Video',
        views: Number(row.youtube_views || 0),
        likes: Number(row.youtube_likes || 0),
      }))
      .slice(0, 8);

  if (!rows.length) {
    container.innerHTML = '<p class="loading">No YouTube videos in snapshot yet.</p>';
    return;
  }

  container.innerHTML = rows.map((row) => `
    <article class="youtube-item">
      <div class="youtube-frame-wrap">
        <iframe src="https://www.youtube.com/embed/${row.id}?rel=0" title="${escapeHtml(row.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>
      <div class="youtube-meta">
        <p>${escapeHtml(row.title)}</p>
        <div class="youtube-stats">
          <span>👁 ${formatNumber(row.views || 0)}</span>
          <span>👍 ${formatNumber(row.likes || 0)}</span>
        </div>
        <a href="https://www.youtube.com/watch?v=${row.id}" target="_blank" rel="noopener">Watch ↗</a>
      </div>
    </article>
  `).join('');
}

function updateStatistics(stats = {}, insights = {}) {
  const totalPosts = insights?.kpi?.total_posts ?? stats.totalPosts ?? 0;
  const totalViews = insights?.kpi?.total_views ?? stats.totalViews ?? 0;
  const avgEngagementRate = insights?.kpi?.avg_engagement_rate ?? stats.avgEngagementRate ?? 0;

  document.getElementById('total-posts').textContent = formatNumber(totalPosts);
  document.getElementById('total-views').textContent = formatNumber(totalViews);
  document.getElementById('avg-engagement').textContent = `${Number(avgEngagementRate || 0).toFixed(2)}%`;

  const posted = insights?.kpi?.posted_count || 0;
  const failed = insights?.kpi?.failed_count || 0;
  document.getElementById('posted-failed').textContent = `${posted} / ${failed}`;
}

function updateQueue(queue = {}) {
  const pending = queue.pending || 0;
  const posted = queue.posted || 0;
  const total = pending + posted;
  const percent = total > 0 ? Math.round((posted / total) * 100) : 0;

  document.getElementById('queue-pending').textContent = pending;
  document.getElementById('queue-posted').textContent = posted;
  document.getElementById('queue-percent').textContent = `${percent}%`;
  document.getElementById('queue-progress').style.width = `${percent}%`;
}

function updateCache(cache = {}) {
  document.getElementById('cache-total').textContent = formatNumber(cache.totalCached || 0);
  document.getElementById('cache-reuses').textContent = formatNumber(cache.totalReuses || 0);
  document.getElementById('cache-avg').textContent = Number(cache.avgReuses || 0).toFixed(1);
}

function updateEngagementChart(analytics) {
  const ctx = document.getElementById('engagementChart');
  if (!ctx) return;
  if (engagementChart) engagementChart.destroy();

  if (!analytics || !analytics.length) {
    return;
  }

  const labels = analytics.map((row) => formatDate(row.date)).reverse();
  const reach = analytics.map((row) => row.totalViews || 0).reverse();
  const likes = analytics.map((row) => row.totalLikes || 0).reverse();
  const comments = analytics.map((row) => row.totalComments || 0).reverse();

  engagementChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Reach',
          data: reach,
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

  const labels = split.map((row) => row.method || 'unknown');
  const values = split.map((row) => row.count || 0);
  if (!values.length) return;

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
  if (!topics || !topics.length) {
    container.innerHTML = '<p class="loading">No trending topics yet</p>';
    return;
  }

  container.innerHTML = topics.map((topic, index) => `
    <div class="trending-item">
      <div><span class="topic-name">#${index + 1} ${escapeHtml(topic.topic || 'Unknown')}</span></div>
      <div class="topic-stats">
        <span>📊 ${topic.posts || topic.usage_count || 0}</span>
        <span>👁️ ${formatNumber(topic.avg_views || 0)}</span>
        <span>💬 ${Number(topic.avg_engagement_rate || 0).toFixed(2)}%</span>
      </div>
    </div>
  `).join('');
}

async function reloadHistory() {
  await refreshSnapshot(true);
}

function applyHistoryFilter() {
  const rows = getUnifiedHistoryRows();
  const status = document.getElementById('status-filter')?.value || 'all';
  filteredHistory = status === 'all' ? rows : rows.filter((row) => row.status === status);
}

function loadHistory() {
  applyHistoryFilter();
  const body = document.getElementById('history-body');
  if (!body) return;

  currentOffset = Math.min(currentOffset, Math.max(0, filteredHistory.length - PAGE_SIZE));
  const rows = filteredHistory.slice(currentOffset, currentOffset + PAGE_SIZE);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9">No posts found.</td></tr>';
  } else {
    body.innerHTML = rows.map((row) => {
      const permalink = row.permalink || (row.instagram_post_id ? `https://www.instagram.com/reel/${instagramShortcode(row.instagram_post_id) || ''}/` : null);
      const youtubeLink = row.youtube_url || (row.youtube_video_id ? `https://www.youtube.com/watch?v=${row.youtube_video_id}` : null);
      const links = [
        permalink ? `<a href="${permalink}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="View on Instagram">IG ↗</a>` : null,
        youtubeLink ? `<a href="${youtubeLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="View on YouTube">YT ↗</a>` : null,
      ].filter(Boolean).join(' • ');
      const link = links || '--';
      return `
        <tr onclick="showPostDetailByKey('${row.rowKey}')">
          <td>${formatDate(row.date)}</td>
          <td>${escapeHtml((row.topic || '--').slice(0, 50))}</td>
          <td><span class="table-status ${row.status || 'pending'}">${(row.status || 'pending').toUpperCase()}</span></td>
          <td>${formatNumber(row.views || 0)}</td>
          <td>${formatNumber(row.likes || 0)}</td>
          <td>${formatNumber(row.comments || 0)}</td>
          <td>${formatNumber(row.shares || 0)}</td>
          <td>${Number(row.engagement_rate || 0).toFixed(2)}%</td>
          <td>${link}</td>
        </tr>`;
    }).join('');
  }

  const page = Math.floor(currentOffset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  document.getElementById('page-indicator').textContent = `Page ${page} of ${pages}`;
}

function instagramShortcode(postId) {
  if (!postId) return null;
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let number = BigInt(postId);
  let result = '';
  while (number > 0n) {
    result = alpha[Number(number % 64n)] + result;
    number /= 64n;
  }
  return result;
}

function showPostDetailByKey(rowKey) {
  const post = getUnifiedHistoryRows().find((row) => row.rowKey === rowKey);
  const detail = document.getElementById('post-detail');
  if (!detail || !post) return;

  const shortcode = instagramShortcode(post.instagram_post_id);
  const permalink = post.permalink || (shortcode ? `https://www.instagram.com/reel/${shortcode}/` : null);
  const instagramBlock = permalink
    ? `<p><strong>Instagram:</strong> <a href="${permalink}" target="_blank" rel="noopener">View Reel ↗</a></p>`
    : `<p><strong>Instagram Post ID:</strong> ${escapeHtml(post.instagram_post_id || '--')}</p>`;
  const youtubeUrl = post.youtube_url || (post.youtube_video_id ? `https://www.youtube.com/watch?v=${post.youtube_video_id}` : null);
  const youtubeBlock = youtubeUrl
    ? `<p><strong>YouTube:</strong> <a href="${youtubeUrl}" target="_blank" rel="noopener">View Video ↗</a></p>`
    : `<p><strong>YouTube Video ID:</strong> ${escapeHtml(post.youtube_video_id || '--')}</p>`;

  detail.innerHTML = `
    <h3>${escapeHtml(post.topic || 'Untitled')}</h3>
    <p><strong>Date:</strong> ${formatDate(post.date)}</p>
    <p><strong>Status:</strong> ${(post.status || 'pending').toUpperCase()}</p>
    <p><strong>Method:</strong> ${escapeHtml(post.generation_method || '--')}</p>
    ${instagramBlock}
    ${youtubeBlock}
    <p><strong>Reach:</strong> ${formatNumber(post.views || 0)} | <strong>Likes:</strong> ${formatNumber(post.likes || 0)}</p>
    <p><strong>Comments:</strong> ${formatNumber(post.comments || 0)} | <strong>Shares:</strong> ${formatNumber(post.shares || 0)}</p>
    <p><strong>Engagement:</strong> ${Number(post.engagement_rate || 0).toFixed(2)}%</p>
    <h4>Script</h4>
    <div class="detail-script">${escapeHtml(post.script || '--')}</div>
  `;
}

function prevPage() {
  if (currentOffset <= 0) return;
  currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
  loadHistory();
}

function nextPage() {
  if (currentOffset + PAGE_SIZE >= filteredHistory.length) return;
  currentOffset += PAGE_SIZE;
  loadHistory();
}

function triggerManualPost() {
  showToast('Run npm run dashboard:refresh on your laptop, then push the updated snapshot.', 'info');
}

function logoutDashboard() {
  window.location.href = 'microsite.html';
}

function formatNumber(num) {
  return Math.round(Number(num || 0)).toLocaleString();
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const date = String(dateStr).includes('T')
    ? new Date(dateStr)
    : new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateTime(timestamp) {
  const value = timestamp ? new Date(timestamp) : new Date();
  document.getElementById('updated-time').textContent = value.toLocaleString();
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
  if (engagementChart) engagementChart.destroy();
  if (methodChart) methodChart.destroy();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshSnapshot();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
