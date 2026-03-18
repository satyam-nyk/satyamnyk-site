import 'dotenv/config';
import axios from 'axios';
import YouTubeService from '../src/services/youtube-service.js';

const yt = new YouTubeService({});
const out = {};

// 1. Auth
let token;
try {
  token = await yt.refreshAccessToken();
  out.auth = 'OK';
} catch (e) { out.auth = 'FAIL: ' + e.message; }

// 2. Channel stats (Data API)
try {
  const ch = await yt.getOwnChannel(token);
  out.channel = ch ? {
    id: ch.id,
    title: ch.snippet?.title,
    customUrl: ch.snippet?.customUrl,
    subscribers: ch.statistics?.subscriberCount,
    totalViews: ch.statistics?.viewCount,
    videoCount: ch.statistics?.videoCount,
  } : null;
} catch (e) { out.channel = 'FAIL: ' + e.message; }

// 3. Video stats (Data API)
try {
  const videos = await yt.getVideoStats(['5cr2g2VbUAc'], token);
  out.videoStats = videos.map((v) => ({
    id: v.id,
    title: v.snippet?.title?.slice(0, 60),
    views: v.statistics?.viewCount,
    likes: v.statistics?.likeCount,
    comments: v.statistics?.commentCount,
    privacy: v.status?.privacyStatus,
    embeddable: v.status?.embeddable,
  }));
} catch (e) { out.videoStats = 'FAIL: ' + e.message; }

// 4. YouTube Analytics API - daily channel report
try {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];
  const r = await axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,likes,comments,subscribersGained,subscribersLost',
      dimensions: 'day',
    },
    timeout: 12000,
  });
  out.analyticsDaily = {
    status: 'OK',
    columns: r.data?.columnHeaders?.map((h) => h.name),
    rowCount: r.data?.rows?.length || 0,
    sampleRows: r.data?.rows?.slice(-3),
  };
} catch (e) {
  out.analyticsDaily = {
    status: 'FAIL',
    code: e.response?.status,
    error: e.response?.data?.error?.message || e.message,
  };
}

// 5. YouTube Analytics API - per-video metrics
try {
  const endDate = new Date().toISOString().split('T')[0];
  const r = await axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      ids: 'channel==MINE',
      startDate: '2026-01-01',
      endDate,
      metrics: 'views,estimatedMinutesWatched,likes,comments',
      dimensions: 'video',
      sort: '-views',
      maxResults: 10,
    },
    timeout: 12000,
  });
  out.analyticsPerVideo = {
    status: 'OK',
    columns: r.data?.columnHeaders?.map((h) => h.name),
    rowCount: r.data?.rows?.length || 0,
    data: r.data?.rows,
  };
} catch (e) {
  out.analyticsPerVideo = {
    status: 'FAIL',
    code: e.response?.status,
    error: e.response?.data?.error?.message || e.message,
  };
}

console.log(JSON.stringify(out, null, 2));
