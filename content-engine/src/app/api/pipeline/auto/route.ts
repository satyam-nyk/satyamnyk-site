import { NextRequest, NextResponse } from "next/server";

import { generateArticle } from "@/lib/ai/generateArticle";
import { blogTheme } from "@/lib/config/blogTheme";
import { publishToDevto } from "@/lib/devto/publish";
import { generateCluster } from "@/lib/seo/generateCluster";
import { generateTopicIdeas } from "@/lib/seo/generateTopicIdeas";
import type { TopicIdea } from "@/lib/seo/generateTopicIdeas";
import { fetchSerpResearch } from "@/lib/seo/serp";
import { connectToDb } from "@/lib/services/db";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";
import { estimateReadingTime, makeSlug } from "@/lib/utils/slug";
import { Article } from "@/models/Article";
import { TopicCluster } from "@/models/TopicCluster";

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);
    const body = await request.json().catch(() => ({}));
    const requestedTopic = String(body?.baseTopic ?? "").trim();
    const articleCount = Math.min(
      Math.max(Number(body?.articleCount ?? blogTheme.settings.articlesPerBatch), 1),
      5
    );
    const publishToDevtoEnabled =
      Boolean(body?.publishToDevto) || blogTheme.settings.publishToDevtoByDefault;

    await connectToDb();

    let baseTopic = requestedTopic;
    let autoIdea: TopicIdea | null = null;

    if (!baseTopic) {
      const recentClusters = await TopicCluster.find({})
        .sort({ createdAt: -1 })
        .select({ baseTopic: 1 })
        .lean()
        .limit(12);

      const ideas = await generateTopicIdeas(
        recentClusters.map((cluster) => cluster.baseTopic)
      );

      autoIdea = ideas[0] ?? null;
      baseTopic = autoIdea?.baseTopic ?? "";
    }

    if (!baseTopic) {
      return NextResponse.json({ error: "No topic available for automation" }, { status: 400 });
    }

    const serpData = await fetchSerpResearch(baseTopic);
    const clusterOutput = await generateCluster(baseTopic, serpData);

    const savedCluster = await TopicCluster.create({
      baseTopic,
      keywords: clusterOutput.keywords,
      questions: serpData.questions,
      relatedSearches: serpData.relatedSearches,
      generatedTitles: clusterOutput.titles,
      category: clusterOutput.category,
    });

    const publishedArticles = [];

    for (const title of clusterOutput.titles.slice(0, articleCount)) {
      const generated = await generateArticle({
        title,
        keywords: savedCluster.keywords,
        category: savedCluster.category,
        questions: savedCluster.questions,
      });

      const baseSlug = makeSlug(generated.title);
      const existing = await Article.countDocuments({ slug: new RegExp(`^${baseSlug}`) });
      const slug = existing ? `${baseSlug}-${existing + 1}` : baseSlug;

      const article = await Article.create({
        title: generated.title,
        slug,
        content: generated.content,
        category: savedCluster.category,
        keywords: savedCluster.keywords,
        metaTitle: generated.metaTitle,
        metaDescription: generated.metaDescription,
        clusterId: savedCluster._id,
        status: "published",
        publishedAt: new Date(),
        readingTimeMinutes: estimateReadingTime(generated.content),
      });

      if (publishToDevtoEnabled) {
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim();
        await publishToDevto({
          title: article.title,
          htmlContent: article.content,
          tags: [article.category, ...article.keywords].slice(0, 4),
          canonicalUrl: `${siteUrl}/blog/${article.slug}`,
          published: true,
        });
      }

      publishedArticles.push(article);
    }

    return NextResponse.json(
      {
        baseTopic,
        autoIdea,
        cluster: savedCluster,
        articles: publishedArticles,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to run pipeline";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
