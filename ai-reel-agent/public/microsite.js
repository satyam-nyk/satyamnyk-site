function fmt(n) {
  if (n === null || n === undefined) return '--';
  return Number(n).toLocaleString();
}

const DEFAULT_INSTAGRAM_PAGE_URL = 'https://www.instagram.com/globaldailydose/';
const DEFAULT_YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/';
const WALL_ITEM_LIMIT = 12;

function fmtDate(date) {
  if (!date) return '--';
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

async function loadPublicConfig() {
  try {
    const response = await fetch(`api/public-config?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.success) return null;
    return data;
  } catch (_) {
    return null;
  }
}

async function fetchDashboardSnapshot() {
  const cacheBust = Date.now();
  const candidates = [
    `dashboard-data.json?t=${cacheBust}`,
    `/dashboard-data.json?t=${cacheBust}`,
    `/dashboard/api/dashboard-data?t=${cacheBust}`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      const json = await response.json();
      if (json?.success) {
        return json;
      }
    } catch (_) {
      // Try the next source.
    }
  }

  throw new Error('dashboard snapshot unavailable');
}

function updateInstagramBadge(pageUrl) {
  const pageLabelEl = document.getElementById('ig-page-label');
  const pageCopyEl = document.getElementById('ig-page-copy');
  const pageLinkEl = document.getElementById('ig-page-link');
  const pageLinkSecondaryEl = document.getElementById('ig-page-link-secondary');
  const navIgLinkEl = document.getElementById('nav-ig-link');
  const menuIgLinkEl = document.getElementById('menu-ig-link');
  const viewAllIgEl = document.getElementById('ig-view-all-link');
  if (!pageLabelEl || !pageCopyEl || !pageLinkEl) return;

  const disableLink = (el) => {
    if (!el) return;
    el.href = '#';
    el.setAttribute('aria-disabled', 'true');
  };

  const enableLink = (el, url) => {
    if (!el) return;
    el.href = url;
    el.removeAttribute('aria-disabled');
  };

  if (!pageUrl) {
    pageLabelEl.textContent = 'Connect your Instagram page URL';
    pageCopyEl.textContent = 'Set INSTAGRAM_PAGE_URL in your environment to show your real profile link here.';
    disableLink(pageLinkEl);
    disableLink(pageLinkSecondaryEl);
    disableLink(navIgLinkEl);
    disableLink(menuIgLinkEl);
    disableLink(viewAllIgEl);
    return;
  }

  pageLabelEl.textContent = pageUrl.replace(/^https?:\/\/www\./i, '').replace(/\/$/, '');
  pageCopyEl.textContent = 'Verified profile link for visitors to view your live Instagram page.';
  enableLink(pageLinkEl, pageUrl);
  enableLink(pageLinkSecondaryEl, pageUrl);
  enableLink(navIgLinkEl, pageUrl);
  enableLink(menuIgLinkEl, pageUrl);
  enableLink(viewAllIgEl, pageUrl);
}

function updateYouTubeBadge(channelUrl, channelTitle) {
  const labelEl = document.getElementById('yt-channel-label');
  const copyEl = document.getElementById('yt-channel-copy');
  const linkEl = document.getElementById('yt-channel-link');
  const linkSecondaryEl = document.getElementById('yt-channel-link-secondary');
  const navYtLinkEl = document.getElementById('nav-yt-link');
  const menuYtLinkEl = document.getElementById('menu-yt-link');
  const viewAllYtEl = document.getElementById('yt-view-all-link');
  if (!labelEl || !copyEl || !linkEl) return;

  const disableLink = (el) => {
    if (!el) return;
    el.href = '#';
    el.setAttribute('aria-disabled', 'true');
  };

  const enableLink = (el, url) => {
    if (!el) return;
    el.href = url;
    el.removeAttribute('aria-disabled');
  };

  if (!channelUrl) {
    labelEl.textContent = 'Connect your YouTube channel';
    copyEl.textContent = 'Enable YouTube in your pipeline to show your real channel link here.';
    disableLink(linkEl);
    disableLink(linkSecondaryEl);
    disableLink(navYtLinkEl);
    disableLink(menuYtLinkEl);
    disableLink(viewAllYtEl);
    return;
  }

  labelEl.textContent = channelTitle || channelUrl.replace(/^https?:\/\/www\./i, '').replace(/\/$/, '');
  copyEl.textContent = 'Latest Shorts and long-form uploads from your connected YouTube channel.';
  enableLink(linkEl, channelUrl);
  enableLink(linkSecondaryEl, channelUrl);
  enableLink(navYtLinkEl, channelUrl);
  enableLink(menuYtLinkEl, channelUrl);
  enableLink(viewAllYtEl, channelUrl);
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

function updateYouTubeEmbeds(historyRows = [], youtubeVideos = []) {
  const gridEl = document.getElementById('yt-embeds-grid');
  if (!gridEl) return;

  const ensureVisibleYouTubeIframesLoaded = () => {
    if (gridEl.closest('.wall-panel--hidden')) return;
    gridEl.querySelectorAll('iframe[data-src]').forEach((iframe) => {
      if (!iframe.getAttribute('src')) {
        iframe.setAttribute('src', iframe.getAttribute('data-src'));
      }
    });
  };

  const fromYoutube = (youtubeVideos || [])
    .map((item) => {
      const videoId = getYouTubeVideoId(item?.id) || getYouTubeVideoId(item?.snippet?.resourceId?.videoId);
      if (!videoId) return null;
      return {
        videoId,
        title: item?.snippet?.title || 'YouTube Short',
        views: Number(item?.statistics?.viewCount || 0),
        likes: Number(item?.statistics?.likeCount || 0),
        comments: Number(item?.statistics?.commentCount || 0),
      };
    })
    .filter(Boolean)
    .slice(0, WALL_ITEM_LIMIT);

  if (!fromYoutube.length) {
    const fallback = (historyRows || [])
      .filter((row) => row?.youtube_video_id)
      .map((row) => ({
        videoId: row.youtube_video_id,
        title: row.topic || 'YouTube video',
        views: Number(row.youtube_views || 0),
        likes: Number(row.youtube_likes || 0),
        comments: Number(row.youtube_comments || 0),
      }))
      .filter((row, index, arr) => arr.findIndex((it) => it.videoId === row.videoId) === index)
      .slice(0, WALL_ITEM_LIMIT);

    if (!fallback.length) {
      gridEl.innerHTML = '<p class="note">No published YouTube videos yet — enable YouTube posting to populate this wall.</p>';
      return;
    }

    gridEl.innerHTML = fallback.map((row) => `
      <article class="ig-embed-item yt-embed-item">
        <div class="yt-frame-wrap">
          <iframe data-src="https://www.youtube.com/embed/${row.videoId}?rel=0" title="${row.title.replace(/"/g, '&quot;')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <div class="ig-card-body">
          <p class="ig-card-caption">${row.title}</p>
          <div class="ig-card-meta">
            <span>👁 ${fmt(row.views)}</span>
            <span>👍 ${fmt(row.likes)}</span>
            <span>💬 ${fmt(row.comments)}</span>
          </div>
          <a class="ig-card-link" href="https://www.youtube.com/watch?v=${row.videoId}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>
        </div>
      </article>
    `).join('');
    ensureVisibleYouTubeIframesLoaded();
    return;
  }

  gridEl.innerHTML = fromYoutube.map((row) => `
    <article class="ig-embed-item yt-embed-item">
      <div class="yt-frame-wrap">
        <iframe data-src="https://www.youtube.com/embed/${row.videoId}?rel=0" title="${row.title.replace(/"/g, '&quot;')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>
      <div class="ig-card-body">
        <p class="ig-card-caption">${row.title}</p>
        <div class="ig-card-meta">
          <span>👁 ${fmt(row.views)}</span>
          <span>👍 ${fmt(row.likes)}</span>
          <span>💬 ${fmt(row.comments)}</span>
        </div>
        <a class="ig-card-link" href="https://www.youtube.com/watch?v=${row.videoId}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>
      </div>
    </article>
  `).join('');

  ensureVisibleYouTubeIframesLoaded();
}

function updateEmbeddedReels(historyRows = [], instagramMedia = []) {
  const gridEl = document.getElementById('ig-embeds-grid');
  if (!gridEl) return;

  const liveMedia = (instagramMedia || [])
    .filter((row) => {
      const permalink = row?.permalink || '';
      return Boolean(permalink);
    })
    .slice(0, WALL_ITEM_LIMIT);

  const normalizeCaption = (text = '') => {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    return value.length > 90 ? `${value.slice(0, 87)}...` : (value || 'View on Instagram');
  };

  const buildCard = (row) => {
    const permalink = row?.permalink || '#';
    const imageUrl = row?.thumbnail_url || row?.media_url || '';
    const caption = normalizeCaption(row?.caption || row?.topic || '');
    const likes = Number(row?.likes || row?.like_count || 0);
    const comments = Number(row?.comments || row?.comments_count || 0);

    return `
      <article class="ig-embed-item">
        <a class="ig-card-media" href="${permalink}" target="_blank" rel="noopener noreferrer">
          ${imageUrl
            ? `<img src="${imageUrl}" alt="Instagram post preview" loading="lazy" referrerpolicy="no-referrer" />`
            : '<div class="ig-card-placeholder">Instagram Post</div>'}
        </a>
        <div class="ig-card-body">
          <p class="ig-card-caption">${caption}</p>
          <div class="ig-card-meta">
            <span>❤ ${fmt(likes)}</span>
            <span>💬 ${fmt(comments)}</span>
          </div>
          <a class="ig-card-link" href="${permalink}" target="_blank" rel="noopener noreferrer">View on Instagram ↗</a>
        </div>
      </article>
    `;
  };

  if (liveMedia.length) {
    gridEl.innerHTML = liveMedia.map(buildCard).join('');
    return;
  }

  const posted = historyRows
    .filter((row) => row.status === 'posted' && row.instagram_post_id)
    .slice(0, WALL_ITEM_LIMIT);

  if (!posted.length) {
    gridEl.innerHTML = '<p class="note">No published reels yet — run the pipeline to generate your first reel.</p>';
    return;
  }

  gridEl.innerHTML = posted
    .map((row) => {
      const shortcode = instagramShortcode(row.instagram_post_id);
      if (!shortcode) return '';
      return buildCard({
        permalink: `https://www.instagram.com/reel/${shortcode}/`,
        caption: row.topic || 'View Reel on Instagram',
        likes: row.likes || 0,
        comments: row.comments || 0,
      });
    })
    .join('');
}

function initWallTabs() {
  const tabs = document.querySelectorAll('.wall-tab');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.wall;

      // Update tab active states
      tabs.forEach((t) => {
        const isActive = t.dataset.wall === target;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', String(isActive));
      });

      // Show / hide panels
      document.querySelectorAll('.wall-panel').forEach((panel) => {
        const isTarget = panel.id === `wall-${target}`;
        panel.classList.toggle('wall-panel--hidden', !isTarget);
      });

      // Some desktop browsers delay/skip iframe initialization in hidden containers.
      if (target === 'youtube') {
        const ytGrid = document.getElementById('yt-embeds-grid');
        ytGrid?.querySelectorAll('iframe[data-src]').forEach((iframe) => {
          if (!iframe.getAttribute('src')) {
            iframe.setAttribute('src', iframe.getAttribute('data-src'));
          }
        });
      }
    });
  });
}

function setupMobileMenu() {
  const toggleBtn = document.getElementById('menu-toggle');
  const menuEl = document.getElementById('mobile-menu');
  if (!toggleBtn || !menuEl) return;

  const closeMenu = () => {
    toggleBtn.setAttribute('aria-expanded', 'false');
    menuEl.classList.remove('open');
    menuEl.setAttribute('aria-hidden', 'true');
  };

  const openMenu = () => {
    toggleBtn.setAttribute('aria-expanded', 'true');
    menuEl.classList.add('open');
    menuEl.setAttribute('aria-hidden', 'false');
  };

  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    if (expanded) closeMenu();
    else openMenu();
  });

  menuEl.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', closeMenu);
  });

  document.addEventListener('click', (event) => {
    if (!menuEl.classList.contains('open')) return;
    if (menuEl.contains(event.target) || toggleBtn.contains(event.target)) return;
    closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 640) {
      closeMenu();
    }
  });
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

  // Keep CTA available on first paint even if stats fetch is slow/fails.
  updateInstagramBadge(DEFAULT_INSTAGRAM_PAGE_URL);
  updateYouTubeBadge(DEFAULT_YOUTUBE_CHANNEL_URL, null);

  try {
    const [data, publicConfig] = await Promise.all([
      fetchDashboardSnapshot(),
      loadPublicConfig(),
    ]);

    const totalPosts = data.instagram?.account?.media_count
      ?? data.insights?.kpi?.total_posts
      ?? data.stats?.totalPosts
      ?? 0;
    const totalViews = data.insights?.kpi?.total_views ?? data.stats?.totalViews ?? 0;
    const avgEngagement = data.insights?.kpi?.avg_engagement_rate ?? data.stats?.avgEngagementRate ?? 0;

    postEl.textContent = fmt(totalPosts);
    viewsEl.textContent = fmt(totalViews);
    engEl.textContent = `${Number(avgEngagement).toFixed(2)}%`;
    methodEl.textContent = data.insights?.methodSplit?.[0]?.method || '--';

    const pageUrl = publicConfig?.instagramPageUrl || data.instagramPageUrl || DEFAULT_INSTAGRAM_PAGE_URL;
    updateInstagramBadge(pageUrl);
    updateEmbeddedReels(data.history || [], data.instagram?.recentMedia || []);

    const channel = data.youtube?.channel || null;
    const channelId = channel?.id || null;
    const channelUrl = channel?.snippet?.customUrl
      ? `https://www.youtube.com/${String(channel.snippet.customUrl).replace(/^@/, '@')}`
      : (channelId ? `https://www.youtube.com/channel/${channelId}` : DEFAULT_YOUTUBE_CHANNEL_URL);
    updateYouTubeBadge(channelUrl, channel?.snippet?.title || null);
    updateYouTubeEmbeds(data.history || [], data.youtube?.recentVideos || []);
  } catch (e) {
    console.error('public stats error', e);
    postEl.textContent = '--';
    viewsEl.textContent = '--';
    engEl.textContent = '--';
    methodEl.textContent = '--';
    updateInstagramBadge(DEFAULT_INSTAGRAM_PAGE_URL);
    updateEmbeddedReels([], []);
    updateYouTubeBadge(DEFAULT_YOUTUBE_CHANNEL_URL, null);
    updateYouTubeEmbeds([], []);
  }
}

syncLoginLinks();
setupMobileMenu();
initWallTabs();
loadPublicStats();
window.addEventListener('pageshow', () => {
  loadPublicStats();
});
