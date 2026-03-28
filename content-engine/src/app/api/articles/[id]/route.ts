import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/services/db";
import { assertAdmin } from "@/lib/utils/requireAdmin";
import { estimateReadingTime, makeSlug } from "@/lib/utils/slug";
import { Article } from "@/models/Article";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertAdmin(request);
    const { id } = await context.params;
    const body = await request.json();

    await connectToDb();

    const update: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
      update.title = body.title.trim();
      update.slug = makeSlug(body.title);
    }

    if (typeof body.content === "string" && body.content.trim()) {
      update.content = body.content;
      update.readingTimeMinutes = estimateReadingTime(body.content);
    }

    if (typeof body.metaTitle === "string") {
      update.metaTitle = body.metaTitle;
    }

    if (typeof body.metaDescription === "string") {
      update.metaDescription = body.metaDescription;
    }

    if (
      typeof body.status === "string" &&
      ["draft", "approved", "rejected", "published"].includes(body.status)
    ) {
      update.status = body.status;
      if (body.status === "published") {
        update.publishedAt = new Date();
      } else {
        update.publishedAt = null;
      }
    }

    if (Array.isArray(body.keywords)) {
      update.keywords = body.keywords.filter(
        (item: unknown) => typeof item === "string"
      );
    }

    const article = await Article.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({ article });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
