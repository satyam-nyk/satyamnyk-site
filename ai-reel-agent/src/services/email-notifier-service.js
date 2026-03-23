import nodemailer from 'nodemailer';

class EmailNotifierService {
  constructor(options = {}) {
    this.enabled = String(options.enabled || process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true';
    this.smtpHost = options.smtpHost || process.env.SMTP_HOST;
    this.smtpPort = Number(options.smtpPort || process.env.SMTP_PORT || 587);
    this.smtpSecure = String(options.smtpSecure || process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    this.smtpUser = options.smtpUser || process.env.SMTP_USER;
    this.smtpPass = options.smtpPass || process.env.SMTP_PASS;
    this.from = options.from || process.env.EMAIL_FROM || this.smtpUser;
    this.recipients = String(options.recipients || process.env.EMAIL_TO || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    this.isConfigured = this.enabled
      && Boolean(this.smtpHost)
      && Boolean(this.smtpUser)
      && Boolean(this.smtpPass)
      && Boolean(this.from)
      && this.recipients.length > 0;

    this.transporter = null;
    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpSecure,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });
    }
  }

  async sendPostOutcome({ status, subjectPrefix = 'AI Reel Agent', details = {} }) {
    if (!this.enabled) return { sent: false, reason: 'disabled' };
    if (!this.isConfigured || !this.transporter) return { sent: false, reason: 'not_configured' };

    const lines = [
      `Status: ${status}`,
      `Timestamp (UTC): ${new Date().toISOString()}`,
      details.slotLabel ? `Slot: ${details.slotLabel}` : null,
      details.slotKey ? `Slot Key: ${details.slotKey}` : null,
      details.topic ? `Topic: ${details.topic}` : null,
      details.instagramPostId ? `Instagram Post ID: ${details.instagramPostId}` : null,
      details.youtubeVideoId ? `YouTube Video ID: ${details.youtubeVideoId}` : null,
      details.durationMs !== undefined ? `Duration (ms): ${details.durationMs}` : null,
      details.error ? `Error: ${details.error}` : null,
      details.requestPath ? `Request Path: ${details.requestPath}` : null,
    ].filter(Boolean);

    const subject = `[${subjectPrefix}] ${status}`;
    await this.transporter.sendMail({
      from: this.from,
      to: this.recipients.join(', '),
      subject,
      text: lines.join('\n'),
    });

    return { sent: true };
  }
}

export default EmailNotifierService;
