import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/services/db";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";
import { Article } from "@/models/Article";
import { TopicCluster } from "@/models/TopicCluster";

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    await connectToDb();

    const [clusters, articles] = await Promise.all([
      TopicCluster.find({}).sort({ createdAt: -1 }).lean(),
      Article.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    const clusterAnalytics = clusters.map((cluster) => {
      const clusterArticles = articles.filter(
        (article) => article.clusterId.toString() === cluster._id.toString()
      );

      const statusCounts = {
        draft: 0,
        approved: 0,
        rejected: 0,
        published: 0,
      };

      for (const article of clusterArticles) {
        if (article.status in statusCounts) {
          statusCounts[article.status as keyof typeof statusCounts] += 1;
        }
      }

      const publishedDates = clusterArticles
        .filter((article) => article.status === "published")
        .map((article) => article.publishedAt ?? article.updatedAt)
        .filter((value): value is Date => Boolean(value));

      const lastPublishedAt =
        publishedDates.length > 0
          ? new Date(Math.max(...publishedDates.map((date) => date.getTime())))
          : null;

      return {
        clusterId: cluster._id,
        baseTopic: cluster.baseTopic,
        category: cluster.category,
        totalArticles: clusterArticles.length,
        statusCounts,
        lastPublishedAt,
      };
    });

    const overview = {
      totalClusters: clusters.length,
      totalArticles: articles.length,
      totalPublished: articles.filter((article) => article.status === "published")
        .length,
      totalDrafts: articles.filter((article) => article.status === "draft").length,
    };

    return NextResponse.json({ overview, clusters: clusterAnalytics });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
