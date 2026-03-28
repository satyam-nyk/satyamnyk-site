import nodemailer from "nodemailer";
import { generateArticle } from "@/lib/ai/generateArticle";
import { blogTheme } from "@/lib/config/blogTheme";
import { publishToDevto } from "@/lib/devto/publish";
import { generateCluster } from "@/lib/seo/generateCluster";
import { generateTopicIdeas } from "@/lib/seo/generateTopicIdeas";
import type { TopicIdea } from "@/lib/seo/generateTopicIdeas";
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
  articlesPerRun: number;
  publishToDevto: boolean;
}

interface ScheduleResult {
  success: boolean;
  articlesGenerated: number;
  articlesPublished: number;
  duration: number;
  error?: string;
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
    if (!this.transporter || !this.config.emailTo?.length) return;

    try {
      const emailBody = [
        `Status: ${status}`,
        `Timestamp (UTC): ${new Date().toISOString()}`,
        `Articles Generated: ${details.articlesGenerated}`,
        `Articles Published: ${details.articlesPublished}`,
        `Duration: ${Math.round(details.duration / 1000)}s`,
        details.error ? `Error: ${details.error}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await this.transporter.sendMail({
        from: this.config.emailFrom,
        to: this.config.emailTo?.join(", "),
        subject: `[AI Product Signals Auto-Blog] ${status}`,
        text: emailBody,
      });
    } catch (error) {
      console.error("[BlogScheduler] Email send failed:", error);
    }
  }

  async runAutoBatch(): Promise<ScheduleResult> {
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

    try {
      await connectToDb();

      // 1. Get recent topics to avoid duplication
      const recentClusters = await TopicCluster.find({})
        .sort({ createdAt: -1 })
        .select({ baseTopic: 1 })
        .lean()
        .limit(12);

      // 2. Generate topic ideas
      const ideas = await generateTopicIdeas(
        recentClusters.map((c) => c.baseTopic)
      );

      if (ideas.length === 0) {
        throw new Error("Failed to generate topic ideas");
      }

      let articlesGenerated = 0;
      let articlesPublished = 0;

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

          // Optionally publish to Dev.to
          if (this.config.publishToDevto) {
            try {
              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://blog.satyamnyk.com";
              await publishToDevto({
                title: article.title,
                htmlContent: article.content,
                tags: cluster.keywords?.slice(0, 4) || [],
                canonicalUrl: `${siteUrl}/blog/${article.slug}`,
                published: true,
              });
              articlesPublished++;
            } catch (devtoError) {
              console.error("[BlogScheduler] Dev.to publish failed:", devtoError);
            }
          } else {
            articlesPublished++;
          }
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
      };

      await this.sendEmail("SUCCESS", result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const result: ScheduleResult = {
        success: false,
        articlesGenerated: 0,
        articlesPublished: 0,
        duration,
        error: errorMsg,
      };

      await this.sendEmail("FAILURE", result);
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
      console.log(
        `[BlogScheduler] Next scheduled run: ${nextRun.toISOString()} (in ${Math.round(delay / 1000 / 60)} minutes)`
      );

      this.schedulerTimeout = setTimeout(async () => {
        console.log("[BlogScheduler] Starting auto-batch run...");
        await this.runAutoBatch();
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
