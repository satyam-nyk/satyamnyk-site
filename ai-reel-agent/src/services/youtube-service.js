import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { API_LIMITS } from '../config/constants.js';

class YouTubeService {
  constructor({
    apiKey,
    clientId,
    clientSecret,
    redirectUri,
    refreshToken,
    apiLimiter = null,
  } = {}) {
    this.apiKey = apiKey || process.env.YOUTUBE_API_KEY;
    this.clientId = clientId || process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret = clientSecret || process.env.YOUTUBE_CLIENT_SECRET;
    this.redirectUri = redirectUri || process.env.YOUTUBE_REDIRECT_URI;
    this.refreshToken = refreshToken || process.env.YOUTUBE_REFRESH_TOKEN;
    this.apiLimiter = apiLimiter;

    this.baseApiUrl = 'https://www.googleapis.com/youtube/v3';
    this.tokenUrl = 'https://oauth2.googleapis.com/token';
    this.authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    this.timeout = API_LIMITS.YOUTUBE.TIMEOUT;
  }

  getAuthUrl({
    state = 'youtube-integration',
    scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    accessType = 'offline',
    prompt = 'consent',
  } = {}) {
    if (!this.clientId || !this.redirectUri) {
      throw new Error('YOUTUBE_CLIENT_ID and YOUTUBE_REDIRECT_URI are required to build auth URL');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope,
      access_type: accessType,
      prompt,
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code) {
    if (!code) {
      throw new Error('Authorization code is required');
    }
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI are required');
    }

    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await axios.post(this.tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: this.timeout,
    });

    return response.data;
  }

  async refreshAccessToken() {
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN are required');
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await axios.post(this.tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: this.timeout,
    });

    return response.data.access_token;
  }

  async getOwnChannel(accessToken = null) {
    const token = accessToken || (await this.refreshAccessToken());

    const response = await axios.get(`${this.baseApiUrl}/channels`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        mine: true,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: this.timeout,
    });

    return response.data?.items?.[0] || null;
  }

  async getVideoStats(videoIds = [], accessToken = null) {
    const ids = [...new Set((videoIds || []).filter(Boolean))];
    if (!ids.length) {
      return [];
    }

    const token = accessToken || (await this.refreshAccessToken());
    const response = await axios.get(`${this.baseApiUrl}/videos`, {
      params: {
        part: 'snippet,statistics,status',
        id: ids.join(','),
        maxResults: Math.min(ids.length, 50),
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: this.timeout,
    });

    return response.data?.items || [];
  }

  async updateVideoPrivacy(videoId, privacyStatus = 'public', accessToken = null) {
    if (!videoId) {
      throw new Error('YouTube video ID is required');
    }

    const token = accessToken || (await this.refreshAccessToken());
    const [video] = await this.getVideoStats([videoId], token);

    if (!video) {
      throw new Error(`YouTube video not found: ${videoId}`);
    }

    const payload = {
      id: videoId,
      snippet: {
        title: video.snippet?.title || '',
        description: video.snippet?.description || '',
        tags: Array.isArray(video.snippet?.tags) ? video.snippet.tags : [],
        categoryId: String(video.snippet?.categoryId || process.env.YOUTUBE_DEFAULT_CATEGORY_ID || '25'),
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: Boolean(video.status?.selfDeclaredMadeForKids),
      },
    };

    const response = await axios.put(`${this.baseApiUrl}/videos`, payload, {
      params: {
        part: 'snippet,status',
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: this.timeout,
    });

    if (this.apiLimiter) {
      await this.apiLimiter.consumeLimit('YOUTUBE', 1);
    }

    const updated = response.data;
    return {
      videoId,
      privacyStatus: updated?.status?.privacyStatus || privacyStatus,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  async uploadShort(videoPath, {
    title,
    description = '',
    tags = [],
    privacyStatus = process.env.YOUTUBE_DEFAULT_PRIVACY || 'public',
    categoryId = process.env.YOUTUBE_DEFAULT_CATEGORY_ID || '25',
  } = {}) {
    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error('Valid local video path is required for YouTube upload');
    }
    if (!title || !String(title).trim()) {
      throw new Error('YouTube title is required');
    }

    const token = await this.refreshAccessToken();

    if (this.apiLimiter && !(await this.apiLimiter.canMakeRequest('YOUTUBE'))) {
      throw new Error('YouTube API quota limit reached in local limiter');
    }

    const stat = fs.statSync(videoPath);
    const mimeType = path.extname(videoPath).toLowerCase() === '.mov' ? 'video/quicktime' : 'video/mp4';

    const initiate = await axios.post(
      'https://www.googleapis.com/upload/youtube/v3/videos',
      {
        snippet: {
          title: String(title).slice(0, 100),
          description: String(description).slice(0, 5000),
          tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
          categoryId: String(categoryId),
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      {
        params: {
          uploadType: 'resumable',
          part: 'snippet,status',
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(stat.size),
          'X-Upload-Content-Type': mimeType,
        },
        timeout: this.timeout,
      }
    );

    const uploadUrl = initiate.headers.location;
    if (!uploadUrl) {
      throw new Error('YouTube resumable upload URL not returned');
    }

    const videoBuffer = fs.readFileSync(videoPath);
    const uploadResponse = await axios.put(uploadUrl, videoBuffer, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Length': stat.size,
        'Content-Type': mimeType,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 0,
    });

    if (this.apiLimiter) {
      await this.apiLimiter.consumeLimit('YOUTUBE', 1);
    }

    const videoId = uploadResponse.data?.id;
    if (!videoId) {
      throw new Error('YouTube upload succeeded but no video ID returned');
    }

    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
    };
  }

  async getRecentUploads(limit = 25, accessToken = null) {
    const maxItems = Math.max(1, Math.min(Number(limit) || 25, 50));
    const token = accessToken || (await this.refreshAccessToken());

    const channel = await this.getOwnChannel(token);
    const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      return [];
    }

    const playlistResponse = await axios.get(`${this.baseApiUrl}/playlistItems`, {
      params: {
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: maxItems,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: this.timeout,
    });

    const items = playlistResponse.data?.items || [];
    const orderedIds = items
      .map((item) => item?.contentDetails?.videoId)
      .filter(Boolean);

    if (!orderedIds.length) {
      return [];
    }

    const statsItems = await this.getVideoStats(orderedIds, token);
    const byId = new Map(statsItems.map((item) => [item.id, item]));

    return orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean);
  }

  /**
   * Fetch channel-level analytics for the last `days` days.
   * Requires the YouTube Analytics API to be enabled in GCP.
   * Returns null (with analyticsEnabled:false) on 403 instead of throwing.
   */
  async getChannelAnalytics(days = 28) {
    const token = await this.refreshAccessToken();
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];

    try {
      const res = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE` +
        `&startDate=${startDate}&endDate=${endDate}` +
        `&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained` +
        `&dimensions=day&sort=day`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.status === 403) {
        return { analyticsEnabled: false, rows: [] };
      }
      if (!res.ok) {
        throw new Error(`Analytics API ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      return { analyticsEnabled: true, columnHeaders: data.columnHeaders, rows: data.rows || [] };
    } catch (err) {
      if (err?.message?.includes('403') || err?.message?.includes('has not been used')) {
        return { analyticsEnabled: false, rows: [] };
      }
      throw err;
    }
  }
}

export default YouTubeService;
