import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublishedArticlesByCategory } from "@/lib/services/content";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ category: string }>;
};

const ALLOWED = ["tech", "history"];

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;

  if (!ALLOWED.includes(category)) {
    notFound();
  }

  const articles = await getPublishedArticlesByCategory(category);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:py-16">
      {/* Page Header */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] md:rounded-3xl md:px-10 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Category Archive
        </p>
        <h1 className="mt-4 text-3xl font-bold capitalize tracking-tight text-zinc-950 md:text-5xl">
          {category === "tech" ? "AI + PM" : "History + Lessons"}
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 md:text-lg md:leading-8">
          {category === "tech"
            ? "AI launches, product implications, future impact, and practical career-building guidance for Product Managers in the AI era."
            : "Historical events, strategic context, and lessons that improve product judgment in modern AI-driven markets."}
        </p>
      </section>

      {/* Articles Grid */}
      <div className="mt-10 grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <article
            key={article._id.toString()}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.04)] transition-all hover:border-teal-300 hover:shadow-[0_20px_70px_rgba(20,184,166,0.08)] md:rounded-2xl md:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {article.readingTimeMinutes} min read
            </p>
            <h2 className="mt-3 text-lg font-bold tracking-tight text-zinc-950 md:text-xl">
              <Link href={`/blog/${article.slug}`} className="hover:text-teal-700">
                {article.title}
              </Link>
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{article.metaDescription}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-US", { month: 'short', day: 'numeric' }) : "Just published"}
              </span>
              <Link href={`/blog/${article.slug}`} className="text-sm font-semibold text-teal-700 hover:text-teal-800">
                Read →
              </Link>
            </div>
          </article>
        ))}
      </div>

      {articles.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <p className="text-zinc-600">No articles in this category yet. Check back soon.</p>
        </div>
      )}
    </main>
  );
}
