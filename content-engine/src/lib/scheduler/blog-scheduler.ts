import nodemailer from "nodemailer";
import { generateArticle } from "@/lib/ai/generateArticle";
import { blogTheme } from "@/lib/config/blogTheme";
import { publishToDevto } from "@/lib/devto/publish";
import { generateCluster } from "@/lib/seo/generateCluster";
import { generateTopicIdeas } from "@/lib/seo/generateTopicIdeas";
import type { TopicIdea, ThemeSlot } from "@/lib/seo/generateTopicIdeas";

// Rotation order: 0=AI, 1=PM, 2=History
const THEME_ROTATION: ThemeSlot[] = ["ai", "pm", "history"];

export function getDailyThemeSlot(): ThemeSlot {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  return THEME_ROTATION[daysSinceEpoch % THEME_ROTATION.length];
}
import { fetchSerpResearch, type SerpResearch } from "@/lib/seo/serp";
import { connectToDb } from "@/lib/services/db";
import { estimateReadingTime, makeSlug } from "@/lib/utils/slug";
import { Article } from "@/models/Article";
import { TopicCluster } from "@/models/TopicCluster";

interface SchedulerConfig {
  enabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  emailFrom?: string;
  emailTo?: string[];
  relayUrl?: string;
  relaySecret?: string;
  resendApiKey?: string;
  resendAudience?: string[];
  articlesPerRun: number;
  publishToDevto: boolean;
}

interface ScheduleResult {
  success: boolean;
  articlesGenerated: number;
  articlesPublished: number;
  duration: number;
  articleLinks?: string[];
  emailSent?: boolean;
  emailError?: string;
  devtoPublished?: number;
  devtoErrors?: string[];
  error?: string;
}

const SMTP_RETRYABLE_ERRORS = ["EBUSY", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ECONNRESET"];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class BlogScheduler {
  private config: SchedulerConfig;
  private transporter: any = null;
  private isRunning = false;
  private schedulerTimeout: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      enabled: String(config?.enabled ?? process.env.BLOG_SCHEDULER_ENABLED ?? "false").toLowerCase() === "true",
      smtpHost: config?.smtpHost ?? process.env.SMTP_HOST,
      smtpPort: Number(config?.smtpPort ?? process.env.SMTP_PORT ?? 587),
      smtpSecure: String(config?.smtpSecure ?? process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
      smtpUser: config?.smtpUser ?? process.env.SMTP_USER,
      smtpPass: config?.smtpPass ?? process.env.SMTP_PASS,
      emailFrom: config?.emailFrom ?? process.env.EMAIL_FROM ?? process.env.SMTP_USER,
      emailTo: config?.emailTo ?? 
        String(process.env.EMAIL_TO ?? "").split(",").map(e => e.trim()).filter(Boolean),
      relayUrl: config?.relayUrl ?? process.env.REEL_AGENT_EMAIL_RELAY_URL,
      relaySecret: config?.relaySecret ?? process.env.REEL_AGENT_WEBHOOK_SECRET,
      resendApiKey: (config?.resendApiKey ?? process.env.RESEND_API_KEY ?? "").trim(),
      resendAudience:
        config?.resendAudience ??
        String(process.env.RESEND_TO ?? process.env.EMAIL_TO ?? "")
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
      articlesPerRun: config?.articlesPerRun ?? 3,
      publishToDevto: config?.publishToDevto ?? blogTheme.settings.publishToDevtoByDefault,
    };

    if (
      this.config.enabled &&
      this.config.smtpHost &&
      this.config.smtpUser &&
      this.config.smtpPass &&
      this.config.emailFrom &&
      (this.config.emailTo?.length ?? 0) > 0
    ) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPass,
        },
      });
    }
  }

  private getScheduleTime(): { nextRun: Date; delay: number } {
    const now = new Date();
    
    // Default: Monday at 9 AM UTC
    // Can be overridden with BLOG_SCHEDULE_TIMES_UTC (comma-separated day:hour, e.g., "1:09,3:09,5:09" for Mon/Wed/Fri)
    const envSchedule = String(process.env.BLOG_SCHEDULE_TIMES_UTC ?? "").trim();
    const schedules = envSchedule
      ? envSchedule.split(",").map(s => {
          const [day, hour] = s.trim().split(":").map(Number);
          return { day: day ?? 1, hour: hour ?? 9 }; // default Monday 9 AM
        })
      : [{ day: 1, hour: 9 }]; // Monday 9 AM UTC

    // Find next scheduled time
    let nextRun: Date | null = null;

    for (const schedule of schedules) {
      const candidate = new Date(now);
      const currentDay = candidate.getUTCDay();
      const targetDay = schedule.day;

      if (targetDay > currentDay || (targetDay === currentDay && candidate.getUTCHours() < schedule.hour)) {
        candidate.setUTCHours(schedule.hour, 0, 0, 0);
        if (targetDay !== currentDay) {
          const daysToAdd = (targetDay - currentDay + 7) % 7;
          candidate.setUTCDate(candidate.getUTCDate() + daysToAdd);
        }
      } else {
        const daysToAdd = (targetDay - currentDay + 7) % 7 || 7;
        candidate.setUTCDate(candidate.getUTCDate() + daysToAdd);
        candidate.setUTCHours(schedule.hour, 0, 0, 0);
      }

      if (!nextRun || candidate < nextRun) {
        nextRun = candidate;
      }
    }

    if (!nextRun) nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const delay = Math.max(0, nextRun.getTime() - now.getTime());
    return { nextRun, delay };
  }

  private async sendEmail(status: "SUCCESS" | "FAILURE", details: ScheduleResult) {
    const articleLines = (details.articleLinks ?? []).map((link) => `Article: ${link}`);
    const lines = [
      `Articles Generated: ${details.articlesGenerated}`,
      `Articles Published: ${details.articlesPublished}`,
      `Duration: ${Math.round(details.duration / 1000)}s`,
      ...articleLines,
      details.error ? `Error: ${details.error}` : null,
    ].filter(Boolean);

    if (this.config.relayUrl) {
      try {
        const response = await fetch(this.config.relayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.relaySecret
              ? { Authorization: `Bearer ${this.config.relaySecret}` }
              : {}),
          },
          body: JSON.stringify({
            status,
            subjectPrefix: "AI Product Signals Auto-Blog",
            details: {
              durationMs: details.duration,
              error: details.error,
            },
            lines,
          }),
        });

        if (response.ok) {
          return { sent: true };
        }

        const payload = await response.json().catch(() => ({}));
        return {
          sent: false,
          error: String(payload.error || `Relay request failed with status ${response.status}`),
        };
      } catch (error) {
        return {
          sent: false,
          error: error instanceof Error ? error.message : "Relay request failed",
        };
      }
    }

    if (this.config.resendApiKey && this.config.emailTo?.length) {
      try {
        const emailBody = [
          `Status: ${status}`,
          `Timestamp (UTC): ${new Date().toISOString()}`,
          ...lines,
        ]
          .filter(Boolean)
          .join("\n");

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: this.config.emailFrom,
            to: this.config.emailTo,
            subject: `[AI Product Signals Auto-Blog] ${status}`,
            text: emailBody,
          }),
        });

        if (response.ok) {
          return { sent: true };
        }

        const payload = await response.json().catch(() => ({}));
        return {
          sent: false,
          error: String(payload.message || payload.error || `Resend request failed with status ${response.status}`),
        };
      } catch (error) {
        return {
          sent: false,
          error: error instanceof Error ? error.message : "Resend request failed",
        };
      }
    }

    if (!this.transporter || !this.config.emailTo?.length) {
      return {
        sent: false,
        error: "Email notifications not configured. Missing relay URL, RESEND_API_KEY, or local SMTP transport.",
      };
    }

    try {
      const emailBody = [
        `Status: ${status}`,
        `Timestamp (UTC): ${new Date().toISOString()}`,
        ...lines,
      ]
        .filter(Boolean)
        .join("\n");

      const mailOptions = {
        from: this.config.emailFrom,
        to: this.config.emailTo?.join(", "),
        subject: `[AI Product Signals Auto-Blog] ${status}`,
        text: emailBody,
      };

      let lastError: unknown = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await this.transporter.sendMail(mailOptions);
          return { sent: true };
        } catch (error) {
          lastError = error;
          const errorCode =
            typeof error === "object" && error !== null && "code" in error
              ? String((error as { code?: unknown }).code ?? "")
              : "";

          if (!SMTP_RETRYABLE_ERRORS.includes(errorCode) || attempt === 3) {
            throw error;
          }

          await wait(1000 * attempt);
        }
      }

      throw lastError instanceof Error ? lastError : new Error("Failed to send email");
    } catch (error) {
      console.error("[BlogScheduler] Email send failed:", error);

      return {
        sent: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }

  async runAutoBatch(themeSlot?: ThemeSlot): Promise<ScheduleResult> {
    if (this.isRunning) {
      return {
        success: false,
        articlesGenerated: 0,
        articlesPublished: 0,
        duration: 0,
        error: "Auto-batch already running",
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const resolvedSlot = themeSlot ?? getDailyThemeSlot();

    try {
      await connectToDb();

      // 1. Get recent topics to avoid duplication
      const recentClusters = await TopicCluster.find({})
        .sort({ createdAt: -1 })
        .select({ baseTopic: 1 })
        .lean()
        .limit(12);

      // 2. Generate topic ideas constrained to today's theme slot
      console.log(`[BlogScheduler] Theme slot for today: ${resolvedSlot}`);
      const ideas = await generateTopicIdeas(
        recentClusters.map((c) => c.baseTopic),
        resolvedSlot
      );

      if (ideas.length === 0) {
        throw new Error("Failed to generate topic ideas");
      }

      let articlesGenerated = 0;
      let articlesPublished = 0;
      let devtoPublished = 0;
      const devtoErrors: string[] = [];
      const articleLinks: string[] = [];
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://blog.satyamnyk.com").trim();

      // 3. Process up to articlesPerRun topics
      for (let i = 0; i < Math.min(ideas.length, this.config.articlesPerRun); i++) {
        const idea = ideas[i];

        try {
          // SERP research
          const serpResults = await fetchSerpResearch(idea.baseTopic);
          if (!serpResults || !serpResults.questions || serpResults.questions.length === 0) {
            console.warn(`[BlogScheduler] No SERP results for "${idea.baseTopic}"`);
            continue;
          }

          // Generate cluster
          const cluster = await generateCluster(idea.baseTopic, serpResults);
          if (!cluster) continue;

          // Get title upfront for use in multiple places
          const selectedTitle = cluster.titles?.[0] || idea.baseTopic;

          const clusterDoc = await TopicCluster.create({
            baseTopic: idea.baseTopic,
            keywords: cluster.keywords || [],
            questions: serpResults.questions || [],
            relatedSearches: serpResults.relatedSearches || [],
            generatedTitles: cluster.titles || [selectedTitle],
            category: cluster.category || "tech",
          });

          // Generate article from selected title
          const articleOutput = await generateArticle({
            title: selectedTitle,
            keywords: cluster.keywords || [],
            category: cluster.category || "tech",
            questions: serpResults.questions,
          });

          if (!articleOutput || !articleOutput.content) continue;

          const slug = makeSlug(selectedTitle);
          const readingTimeMinutes = estimateReadingTime(articleOutput.content);

          const article = await Article.create({
            title: articleOutput.title,
            slug,
            content: articleOutput.content,
            category: cluster.category || "tech",
            status: "published", // Auto-publish
            metaTitle: articleOutput.metaTitle,
            metaDescription: articleOutput.metaDescription,
            readingTimeMinutes,
            clusterId: clusterDoc._id,
            publishedAt: new Date(),
          });

          articlesGenerated++;
          articleLinks.push(`${siteUrl}/blog/${article.slug}`);

          // Optionally publish to Dev.to
          if (this.config.publishToDevto) {
            try {
              await publishToDevto({
                title: article.title,
                htmlContent: article.content,
                tags: cluster.keywords?.slice(0, 4) || [],
                canonicalUrl: `${siteUrl}/blog/${article.slug}`,
                published: true,
              });
              devtoPublished++;
              console.log(`[BlogScheduler] Published to Dev.to: ${article.title}`);
            } catch (devtoError) {
              const errorMsg = devtoError instanceof Error ? devtoError.message : String(devtoError);
              console.error("[BlogScheduler] Dev.to publish failed:", errorMsg);
              devtoErrors.push(`${article.title}: ${errorMsg}`);
            }
          }
          articlesPublished++;
        } catch (topicError) {
          console.error(`[BlogScheduler] Failed to process topic "${idea.baseTopic}":`, topicError);
          continue;
        }
      }

      const duration = Date.now() - startTime;
      const result: ScheduleResult = {
        success: true,
        articlesGenerated,
        articlesPublished,
        duration,
        articleLinks,
        devtoPublished,
        ...(devtoErrors.length > 0 && { devtoErrors }),
      };

      const emailResult = await this.sendEmail("SUCCESS", result);
      result.emailSent = emailResult.sent;
      result.emailError = emailResult.error;
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const result: ScheduleResult = {
        success: false,
        articlesGenerated: 0,
        articlesPublished: 0,
        duration,
        articleLinks: [],
        devtoPublished: 0,
        error: errorMsg,
      };

      const emailResult = await this.sendEmail("FAILURE", result);
      result.emailSent = emailResult.sent;
      result.emailError = emailResult.error;
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  schedule() {
    if (!this.config.enabled) {
      console.log("[BlogScheduler] Auto-scheduler disabled");
      return;
    }

    if (!this.transporter) {
      console.warn("[BlogScheduler] Email notifications not configured");
    }

    const scheduleNext = () => {
      const { nextRun, delay } = this.getScheduleTime();
      const slot = getDailyThemeSlot();
      console.log(
        `[BlogScheduler] Next scheduled run: ${nextRun.toISOString()} (in ${Math.round(delay / 1000 / 60)} minutes) — theme: ${slot}`
      );

      this.schedulerTimeout = setTimeout(async () => {
        const currentSlot = getDailyThemeSlot();
        console.log(`[BlogScheduler] Starting auto-batch run — theme: ${currentSlot}`);
        await this.runAutoBatch(currentSlot);
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  stop() {
    if (this.schedulerTimeout) {
      clearTimeout(this.schedulerTimeout);
      this.schedulerTimeout = null;
      console.log("[BlogScheduler] Scheduler stopped");
    }
  }
}

export default BlogScheduler;
