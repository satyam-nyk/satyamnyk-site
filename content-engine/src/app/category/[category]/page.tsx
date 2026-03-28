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
    <main className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
      <section className="rounded-[2rem] border border-zinc-200 bg-white px-7 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          Category Archive
        </p>
        <h1 className="mt-4 text-4xl font-semibold capitalize tracking-tight text-zinc-950 md:text-5xl">
          {category === "tech" ? "AI + PM" : "History + Lessons"}
        </h1>
        <p className="mt-3 max-w-3xl text-zinc-600">
          {category === "tech"
            ? "AI launches, product implications, future impact, and practical career-building guidance for Product Managers in the AI era."
            : "Historical events, strategic context, and lessons that improve product judgment in modern AI-driven markets."}
        </p>
      </section>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {articles.map((article) => (
          <article
            key={article._id.toString()}
            className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)]"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              {article.readingTimeMinutes} min read
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              <Link href={`/blog/${article.slug}`} className="hover:text-teal-700">
                {article.title}
              </Link>
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{article.metaDescription}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
