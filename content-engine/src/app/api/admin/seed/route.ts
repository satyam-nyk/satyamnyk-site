import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/services/db";
import { estimateReadingTime, makeSlug } from "@/lib/utils/slug";
import { assertAdmin } from "@/lib/utils/requireAdmin";
import { Article } from "@/models/Article";
import { TopicCluster } from "@/models/TopicCluster";

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);
    await connectToDb();

    const now = Date.now();
    const topic = `Demo Content Cluster ${new Date(now).toLocaleDateString("en-IN")}`;

    const cluster = await TopicCluster.create({
      baseTopic: topic,
      keywords: ["ai tools", "seo strategy", "content marketing", "india startups"],
      questions: [
        "How do AI tools improve SEO workflows?",
        "What content format ranks fastest for new blogs?",
      ],
      relatedSearches: [
        "ai seo workflow",
        "content cluster strategy",
        "seo content for startups in india",
      ],
      generatedTitles: [
        "AI SEO Playbook for Early-Stage Startups",
        "How to Build a Topic Cluster That Ranks in 90 Days",
        "Content Operations Framework for Small Marketing Teams",
      ],
      category: "tech",
    });

    const templates = [
      {
        title: "AI SEO Playbook for Early-Stage Startups",
        status: "published" as const,
      },
      {
        title: "How to Build a Topic Cluster That Ranks in 90 Days",
        status: "approved" as const,
      },
      {
        title: "Content Operations Framework for Small Marketing Teams",
        status: "draft" as const,
      },
    ];

    const createdArticles = [];

    for (const template of templates) {
      const slugBase = makeSlug(template.title);
      const slug = `${slugBase}-${now}`;
      const content = buildDemoHtml(template.title);

      const article = await Article.create({
        title: template.title,
        slug,
        content,
        category: "tech",
        keywords: ["ai tools", "seo strategy", "topic cluster"],
        metaTitle: `${template.title} | Content Engine Demo`,
        metaDescription:
          "Demo article generated for portfolio showcase. Includes SEO structure and practical framework.",
        clusterId: cluster._id,
        status: template.status,
        readingTimeMinutes: estimateReadingTime(content),
        publishedAt: template.status === "published" ? new Date() : null,
      });

      createdArticles.push(article);
    }

    return NextResponse.json(
      {
        message: "Demo data seeded successfully",
        cluster,
        articles: createdArticles,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to seed demo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildDemoHtml(title: string) {
  return `
    <h1>${title}</h1>
    <p>This is demo content generated for portfolio showcase. It demonstrates how a single topic cluster can power multiple articles while keeping a consistent SEO strategy.</p>
    <h2>Why This Matters</h2>
    <p>Teams usually waste time creating isolated posts. Cluster-driven workflows improve topical authority, planning speed, and internal linking opportunities.</p>
    <h2>Framework</h2>
    <h3>Step 1: Capture SERP Signals</h3>
    <p>Collect related searches, FAQs, and intent cues from one SERP query per base topic.</p>
    <h3>Step 2: Expand into Content Ideas</h3>
    <p>Generate 5 to 10 article angles that target different long-tail intents while sharing one research baseline.</p>
    <h3>Step 3: Publish with Editorial Control</h3>
    <p>Use draft, approve, and publish states to maintain quality before sending content live.</p>
    <h2>FAQ</h2>
    <h3>Can one cluster support many posts?</h3>
    <p>Yes. That is the core efficiency gain of this workflow.</p>
    <h3>Is this useful for India-focused startups?</h3>
    <p>Yes. Cluster pages can be localized with India market examples and relevant intent terms.</p>
  `;
}
