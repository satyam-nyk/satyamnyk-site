/**
 * AI Reel Agent Dashboard - Frontend JavaScript
 * Real-time dashboard with live updates
 */

// Configuration
const API_BASE_URL = '/dashboard/api/dashboard-data';
const REFRESH_INTERVAL = 30000; // 30 seconds
const CHART_CONFIG = {
  type: 'line',
  options: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: '#cbd5e1',
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: '#334155'
      }
    },
    scales: {
      x: {
        grid: { color: '#334155' },
        ticks: { color: '#94a3b8' }
      },
      y: {
        grid: { color: '#334155' },
        ticks: { color: '#94a3b8' }
      }
    }
  }
};

let engagementChart = null;
let updateTimeout = null;

/**
 * Initialize dashboard
 */
async function initDashboard() {
  console.log('[Dashboard] Initializing...');
  
  // Initial data fetch
  await updateDashboard();
  
  // Set up auto-refresh
  if (updateTimeout) clearInterval(updateTimeout);
  updateTimeout = setInterval(updateDashboard, REFRESH_INTERVAL);
  
  console.log('[Dashboard] Initialized');
}

/**
 * Fetch and update all dashboard data
 */
async function updateDashboard() {
  try {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    
    updateUI(data);
    updateTime();
    showToast('Dashboard updated', 'success');
  } catch (error) {
    console.error('[Dashboard] Error updating:', error);
    showToast('Failed to update dashboard', 'error');
  }
}

/**
 * Update UI with new data
 */
function updateUI(data) {
  // Update today's reel
  updateTodaySection(data.today);
  
  // Update API usage
  updateAPIUsage(data.apiUsage);
  
  // Update statistics
  updateStatistics(data.stats);
  
  // Update queue
  updateQueue(data.queue);
  
  // Update cache
  updateCache(data.cache);
  
  // Update engagement chart
  updateEngagementChart(data.analytics);
  
  // Update trending topics
  updateTrendingTopics(data.trendingTopics);
}

/**
 * Update today's reel section
 */
function updateTodaySection(today) {
  if (!today) return;
  
  const post = today.post;
  
  // Update status badge
  const statusBadge = document.getElementById('today-status');
  statusBadge.textContent = post?.status?.toUpperCase() || 'NOT STARTED';
  statusBadge.className = `status-badge ${post?.status || 'pending'}`;
  
  // Update topic
  const topicEl = document.getElementById('today-topic');
  topicEl.textContent = post?.topic || 'Waiting for generation...';
  
  // Update script
  const scriptEl = document.getElementById('today-script');
  scriptEl.textContent = post?.script || 'Script will appear here';
  
  // Update generator
  document.getElementById('today-generator').textContent = post?.generation_method || '--';
  
  // Update posted status
  const postedEl = document.getElementById('today-posted');
  if (post?.posted_at) {
    postedEl.textContent = new Date(post.posted_at).toLocaleTimeString();
  } else {
    postedEl.textContent = '--';
  }
}

/**
 * Update API usage displays
 */
function updateAPIUsage(apiUsage) {
  if (!apiUsage) return;
  
  // Gemini
  updateAPIBar('gemini', apiUsage.gemini);
  
  // HeyGen
  updateAPIBar('heygen', apiUsage.heygen);
  
  // Instagram
  updateAPIBar('instagram', apiUsage.instagram);
}

/**
 * Update individual API bar
 */
function updateAPIBar(service, data) {
  const percentUsed = Math.round((data.used / data.limit) * 100) || 0;
  
  // Update progress bar
  const progressEl = document.getElementById(`${service}-progress`);
  progressEl.style.width = `${percentUsed}%`;
  
  // Update used/limit text
  document.getElementById(`${service}-used`).textContent = data.used;
  document.getElementById(`${service}-limit`).textContent = data.limit;
  
  // Update status color
  const statusEl = document.getElementById(`${service}-status`);
  statusEl.className = 'status-light';
  if (percentUsed >= 80) {
    statusEl.classList.add('danger');
  } else if (percentUsed >= 60) {
    statusEl.classList.add('warning');
  } else {
    statusEl.classList.add('healthy');
  }
}

/**
 * Update statistics
 */
function updateStatistics(stats) {
  if (!stats) return;
  
  document.getElementById('total-posts').textContent = formatNumber(stats.totalPosts);
  document.getElementById('total-views').textContent = formatNumber(stats.totalViews);
  document.getElementById('avg-views').textContent = formatNumber(stats.avgViews);
  document.getElementById('total-likes').textContent = formatNumber(stats.totalLikes);
}

/**
 * Update queue status
 */
function updateQueue(queue) {
  if (!queue) return;
  
  document.getElementById('queue-pending').textContent = queue.pending;
  document.getElementById('queue-posted').textContent = queue.posted;
  document.getElementById('queue-percent').textContent = `${queue.percentComplete}%`;
  document.getElementById('queue-progress').style.width = `${queue.percentComplete}%`;
}

/**
 * Update cache stats
 */
function updateCache(cache) {
  if (!cache) return;
  
  document.getElementById('cache-total').textContent = cache.totalCached;
  document.getElementById('cache-reuses').textContent = cache.totalReuses;
  document.getElementById('cache-avg').textContent = (cache.avgReuses || 0).toFixed(1);
}

/**
 * Update engagement chart
 */
function updateEngagementChart(analytics) {
  if (!analytics || analytics.length === 0) return;
  
  const labels = analytics.map(a => formatDate(a.date)).reverse();
  const views = analytics.map(a => a.totalViews).reverse();
  const likes = analytics.map(a => a.totalLikes).reverse();
  const comments = analytics.map(a => a.totalComments).reverse();
  
  const ctx = document.getElementById('engagementChart');
  if (!ctx) return;
  
  if (engagementChart) {
    engagementChart.destroy();
  }
  
  engagementChart = new Chart(ctx, {
    ...CHART_CONFIG,
    data: {
      labels,
      datasets: [
        {
          label: 'Views',
          data: views,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Likes',
          data: likes,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Comments',
          data: comments,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    }
  });
}

/**
 * Update trending topics list
 */
function updateTrendingTopics(topics) {
  const container = document.getElementById('trending-topics');
  if (!container) return;
  
  if (!topics || topics.length === 0) {
    container.innerHTML = '<p class="loading">No trending topics yet</p>';
    return;
  }
  
  container.innerHTML = topics.map((topic, index) => `
    <div class="trending-item">
      <div>
        <span class="topic-name">#${index + 1} ${topic.topic || 'Unknown'}</span>
      </div>
      <div class="topic-stats">
        <span title="Usage Count">📊 ${topic.usage_count || 0}</span>
        <span title="Average Views">👁️ ${formatNumber(topic.avg_views || 0)}</span>
      </div>
    </div>
  `).join('');
}

/**
 * Trigger manual post
 */
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
        'Authorization': `Bearer ${getWebhookSecret()}`
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to post');
    }
    
    showToast('Post created successfully!', 'success');
    await updateDashboard();
  } catch (error) {
    console.error('[Dashboard] Error posting:', error);
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Get webhook secret from environment or localStorage
 */
function getWebhookSecret() {
  return localStorage.getItem('webhook-secret') || '';
}

/**
 * Format numbers with thousands separator
 */
function formatNumber(num) {
  if (!num) return '0';
  return Math.round(num).toLocaleString();
}

/**
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Update last updated timestamp
 */
function updateTime() {
  const now = new Date();
  document.getElementById('updated-time').textContent = now.toLocaleTimeString();
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

/**
 * Clean up on page unload
 */
window.addEventListener('beforeunload', () => {
  if (updateTimeout) clearInterval(updateTimeout);
  if (engagementChart) engagementChart.destroy();
});

/**
 * Visibility change handler - pause updates when hidden
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (updateTimeout) clearInterval(updateTimeout);
  } else {
    updateDashboard();
    updateTimeout = setInterval(updateDashboard, REFRESH_INTERVAL);
  }
});

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
