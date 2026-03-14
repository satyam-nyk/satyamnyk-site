function fmt(n) {
  if (n === null || n === undefined) return '--';
  return Number(n).toLocaleString();
}

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

function updateInstagramBadge(pageUrl) {
  const pageLabelEl = document.getElementById('ig-page-label');
  const pageCopyEl = document.getElementById('ig-page-copy');
  const pageLinkEl = document.getElementById('ig-page-link');
  const pageLinkSecondaryEl = document.getElementById('ig-page-link-secondary');
  const navIgLinkEl = document.getElementById('nav-ig-link');
  const menuIgLinkEl = document.getElementById('menu-ig-link');
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
    return;
  }

  pageLabelEl.textContent = pageUrl.replace(/^https?:\/\/www\./i, '').replace(/\/$/, '');
  pageCopyEl.textContent = 'Verified profile link for visitors to view your live Instagram page.';
  enableLink(pageLinkEl, pageUrl);
  enableLink(pageLinkSecondaryEl, pageUrl);
  enableLink(navIgLinkEl, pageUrl);
  enableLink(menuIgLinkEl, pageUrl);
}

function updateEmbeddedReels(historyRows = [], instagramMedia = []) {
  const gridEl = document.getElementById('ig-embeds-grid');
  if (!gridEl) return;

  const liveMedia = (instagramMedia || [])
    .filter((row) => {
      const permalink = row?.permalink || '';
      return Boolean(permalink);
    })
    .slice(0, 16);

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
    .slice(0, 16);

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

  try {
    const [statsRes, publicConfig] = await Promise.all([
      fetch(`dashboard-data.json?t=${Date.now()}`),
      loadPublicConfig(),
    ]);
    const data = await statsRes.json();
    if (!statsRes.ok || !data.success) throw new Error('stats unavailable');

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

    const pageUrl = publicConfig?.instagramPageUrl || data.instagramPageUrl || null;
    updateInstagramBadge(pageUrl);
    updateEmbeddedReels(data.history || [], data.instagram?.recentMedia || []);
  } catch (e) {
    console.error('public stats error', e);
    postEl.textContent = '--';
    viewsEl.textContent = '--';
    engEl.textContent = '--';
    methodEl.textContent = '--';
    updateInstagramBadge(null);
    updateEmbeddedReels([], []);
  }
}

syncLoginLinks();
setupMobileMenu();
loadPublicStats();
