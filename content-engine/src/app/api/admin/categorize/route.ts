import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/services/db";
import { assertAdmin } from "@/lib/utils/requireAdmin";
import { Article } from "@/models/Article";

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);
    await connectToDb();

    const body = await request.json();
    const { articleId, category } = body;

    if (!articleId || !["tech", "history"].includes(category)) {
      return NextResponse.json(
        { error: "Invalid articleId or category" },
        { status: 400 }
      );
    }

    const article = await Article.findByIdAndUpdate(
      articleId,
      { category },
      { new: true }
    );

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Article category updated",
      article,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    await connectToDb();

    const articles = await Article.find({ status: "published" }).lean();

    // Count by category
    const techCount = articles.filter((a) => a.category === "tech").length;
    const historyCount = articles.filter((a) => a.category === "history").length;

    return NextResponse.json({
      total: articles.length,
      tech: techCount,
      history: historyCount,
      articles,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
