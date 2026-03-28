import { NextRequest, NextResponse } from "next/server";
import BlogScheduler from "@/lib/scheduler/blog-scheduler";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";

// Global scheduler instance
let scheduler: BlogScheduler | null = null;

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);

    if (scheduler) {
      return NextResponse.json({
        success: true,
        message: "Scheduler already running",
      });
    }

    scheduler = new BlogScheduler({
      enabled: true,
      articlesPerRun: 3,
      publishToDevto: true,
    });

    scheduler.schedule();

    return NextResponse.json({
      success: true,
      message: "Blog scheduler started successfully",
      config: {
        enabled: true,
        articlesPerRun: 3,
        scheduleTime: "Default: Monday 9 AM UTC (customize via BLOG_SCHEDULE_TIMES_UTC)",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start scheduler" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertAdmin(request);

    if (scheduler) {
      scheduler.stop();
      scheduler = null;
    }

    return NextResponse.json({
      success: true,
      message: "Blog scheduler stopped",
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to stop scheduler" },
      { status: 500 }
    );
  }
}
