import { connectToDb } from "@/lib/services/db";
import { Article } from "@/models/Article";
import { TopicCluster } from "@/models/TopicCluster";

export async function getPublishedArticles() {
  try {
    await connectToDb();
    return await Article.find({ status: "published" }).sort({ createdAt: -1 }).lean();
  } catch (error) {
    console.error("Failed to load published articles", error);
    return [];
  }
}

export async function getPublishedArticleBySlug(slug: string) {
  try {
    await connectToDb();
    return await Article.findOne({ slug, status: "published" }).lean();
  } catch (error) {
    console.error("Failed to load published article by slug", error);
    return null;
  }
}

export async function getPublishedArticlesByCategory(category: string) {
  try {
    await connectToDb();
    return await Article.find({ status: "published", category })
      .sort({ createdAt: -1 })
      .lean();
  } catch (error) {
    console.error("Failed to load published articles by category", error);
    return [];
  }
}

export async function getClusterMap() {
  await connectToDb();

  const clusters = await TopicCluster.find({}).sort({ createdAt: -1 }).lean();
  const articles = await Article.find({}).sort({ createdAt: -1 }).lean();

  return clusters.map((cluster) => ({
    cluster,
    articles: articles.filter(
      (article) => article.clusterId.toString() === cluster._id.toString()
    ),
  }));
}
