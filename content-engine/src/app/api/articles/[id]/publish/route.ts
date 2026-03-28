import { NextRequest, NextResponse } from "next/server";

import { publishToDevto } from "@/lib/devto/publish";
import { connectToDb } from "@/lib/services/db";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";
import { Article } from "@/models/Article";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertAdmin(request);
    const { id } = await context.params;
    await connectToDb();

    const article = await Article.findById(id);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const shouldPublishToDevto =
      request.nextUrl.searchParams.get("devto") === "true";

    let devtoResponse: unknown = null;

    if (shouldPublishToDevto) {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim();
      const canonicalUrl = `${siteUrl}/blog/${article.slug}`;

      devtoResponse = await publishToDevto({
        title: article.title,
        htmlContent: article.content,
        tags: [article.category, ...article.keywords].slice(0, 4),
        canonicalUrl,
        published: true,
      });
    }

    article.status = "published";
    article.publishedAt = new Date();
    await article.save();

    return NextResponse.json({ article, devtoResponse });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to publish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
