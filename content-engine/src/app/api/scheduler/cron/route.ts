import { NextRequest, NextResponse } from "next/server";
import BlogScheduler, { getDailyThemeSlot } from "@/lib/scheduler/blog-scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * External cron endpoint for blog auto-publishing
 * Call this via EasyCron, cron-job.org, or GitHub Actions with:
 * POST https://blog.satyamnyk.com/api/scheduler/cron
 * Header: X-Cron-Secret: [CRON_SECRET from env]
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get("X-Cron-Secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || !cronSecret || cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine today's theme slot in the rotation (AI → PM → History)
    const themeSlot = getDailyThemeSlot();

    // Run the auto-batch
    const scheduler = new BlogScheduler({
      enabled: true,
      articlesPerRun: Number(process.env.BLOG_ARTICLES_PER_RUN ?? 1),
      publishToDevto: String(process.env.BLOG_PUBLISH_DEVTO ?? "true").toLowerCase() === "true",
    });

    const result = await scheduler.runAutoBatch(themeSlot);

    return NextResponse.json({
      success: result.success,
      articlesGenerated: result.articlesGenerated,
      articlesPublished: result.articlesPublished,
      duration: result.duration,
      articleLinks: result.articleLinks ?? [],
      emailSent: result.emailSent ?? false,
      emailError: result.emailError,
      themeSlot,
      message: result.error || `Auto-batch completed successfully (theme: ${themeSlot})`,
    });
  } catch (error) {
    console.error("[Cron] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to run auto-batch",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check cron job status (for monitoring)
 */
export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get("X-Cron-Secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || !cronSecret || cronSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ready",
    endpoint: "/api/scheduler/cron",
    method: "POST",
    requiredHeaders: {
      "X-Cron-Secret": "Your CRON_SECRET from environment",
    },
    example: `curl -X POST https://blog.satyamnyk.com/api/scheduler/cron \\
  -H "X-Cron-Secret: your_secret" \\
  -H "Content-Type: application/json"`,
  });
}
