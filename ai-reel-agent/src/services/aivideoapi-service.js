import axios from 'axios';

class AIVideoAPIService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.AIVIDEOAPI_KEY || '';
    this.baseURL = process.env.AIVIDEOAPI_BASE_URL || 'https://api.aivideoapi.com';
    this.enabled = String(process.env.AIVIDEOAPI_ENABLED || 'false').toLowerCase() === 'true';
  }

  isConfigured() {
    return Boolean(this.enabled && this.apiKey);
  }

  async generateTextVideo(prompt, {
    model = process.env.AIVIDEOAPI_MODEL || 'gen3',
    time = Number(process.env.AIVIDEOAPI_TIME_SECONDS || 10),
    width = Number(process.env.AIVIDEOAPI_WIDTH || 1344),
    height = Number(process.env.AIVIDEOAPI_HEIGHT || 768),
    timeoutMs = Number(process.env.AIVIDEOAPI_GENERATION_TIMEOUT_MS || 480000),
  } = {}) {
    if (!this.isConfigured()) {
      throw new Error('AIVideoAPI is not configured');
    }

    const textPrompt = String(prompt || '').trim();
    if (!textPrompt) {
      throw new Error('AIVideoAPI prompt is required');
    }

    const submitResponse = await axios.post(
      `${this.baseURL}/runway/generate/text`,
      {
        text_prompt: textPrompt,
        model,
        width,
        height,
        time,
      },
      {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 60000,
      },
    );

    const uuid = submitResponse?.data?.uuid
      || submitResponse?.data?.data?.uuid
      || submitResponse?.data?.id
      || submitResponse?.data?.task_id;

    if (!uuid) {
      throw new Error('AIVideoAPI did not return a task uuid');
    }

    const startedAt = Date.now();
    const pollIntervalMs = 5000;

    while (Date.now() - startedAt < timeoutMs) {
      let statusResponse;
      try {
        statusResponse = await axios.get(`${this.baseURL}/runway/status`, {
          params: { uuid },
          headers: {
            accept: 'application/json',
            'x-api-key': this.apiKey,
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        });
      } catch (primaryError) {
        statusResponse = await axios.get(`${this.baseURL}/status`, {
          params: { uuid },
          headers: {
            accept: 'application/json',
            'x-api-key': this.apiKey,
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        });
      }

      const raw = statusResponse?.data || {};
      const status = String(
        raw.status || raw.state || raw.data?.status || raw.data?.state || '',
      ).toLowerCase();

      if (status === 'success') {
        const videoUrl = raw.video_url
          || raw.url
          || raw.output_url
          || raw.data?.video_url
          || raw.data?.url
          || raw.data?.output_url;

        if (!videoUrl) {
          throw new Error('AIVideoAPI completed but returned no video URL');
        }

        return { uuid, status: 'success', videoUrl };
      }

      if (status === 'failed') {
        const details = raw.error || raw.error_message || raw.message || 'Unknown failure';
        throw new Error(`AIVideoAPI generation failed: ${details}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('AIVideoAPI generation timed out');
  }
}

export default AIVideoAPIService;