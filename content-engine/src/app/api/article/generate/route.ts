import { NextRequest, NextResponse } from "next/server";

import { generateArticle } from "@/lib/ai/generateArticle";
import { publishToDevto } from "@/lib/devto/publish";
import { connectToDb } from "@/lib/services/db";
import { makeSlug, estimateReadingTime } from "@/lib/utils/slug";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";
import { Article } from "@/models/Article";
import { TopicCluster } from "@/models/TopicCluster";

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const clusterId = String(body?.clusterId ?? "");
    const title = String(body?.title ?? "").trim();
    const autoPublish = body?.autoPublish !== false;
    const publishToDevtoEnabled = body?.publishToDevto === true;

    if (!clusterId || !title) {
      return NextResponse.json(
        { error: "clusterId and title are required" },
        { status: 400 }
      );
    }

    await connectToDb();

    const cluster = await TopicCluster.findById(clusterId).lean();
    if (!cluster) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }

    const generated = await generateArticle({
      title,
      keywords: cluster.keywords,
      category: cluster.category,
      questions: cluster.questions,
    });

    const baseSlug = makeSlug(generated.title);
    const existing = await Article.countDocuments({ slug: new RegExp(`^${baseSlug}`) });
    const slug = existing ? `${baseSlug}-${existing + 1}` : baseSlug;

    const saved = await Article.create({
      title: generated.title,
      slug,
      content: generated.content,
      category: cluster.category,
      keywords: cluster.keywords,
      metaTitle: generated.metaTitle,
      metaDescription: generated.metaDescription,
      clusterId: cluster._id,
      status: autoPublish ? "published" : "draft",
      publishedAt: autoPublish ? new Date() : null,
      readingTimeMinutes: estimateReadingTime(generated.content),
    });

    let devtoResponse: unknown = null;

    if (autoPublish && publishToDevtoEnabled) {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim();
      devtoResponse = await publishToDevto({
        title: saved.title,
        htmlContent: saved.content,
        tags: [saved.category, ...saved.keywords].slice(0, 4),
        canonicalUrl: `${siteUrl}/blog/${saved.slug}`,
        published: true,
      });
    }

    return NextResponse.json({ article: saved, devtoResponse }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
