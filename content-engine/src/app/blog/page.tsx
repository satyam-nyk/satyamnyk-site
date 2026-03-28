import Link from "next/link";
import type { Metadata } from "next";

import { blogTheme } from "@/lib/config/blogTheme";
import { getPublishedArticles } from "@/lib/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${blogTheme.publicationName} | Latest`,
  description: blogTheme.metaDescription,
};

export default async function BlogPage() {
  const articles = await getPublishedArticles();
  const [featured, ...rest] = articles;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
      <section className="rounded-[2rem] border border-zinc-200 bg-white px-7 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] md:px-10 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Latest</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-zinc-950 md:text-6xl">
          AI news, future impact, historical context, and PM career insights.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-600 md:text-lg">
          Editorially focused posts for builders, operators, and Product Managers navigating
          fast AI change.
        </p>
      </section>

      {featured ? (
        <section className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-[2rem] border border-zinc-200 bg-zinc-950 p-8 text-white shadow-[0_28px_100px_rgba(15,23,42,0.2)] md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-300">Featured Story</p>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
              <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-300">{featured.metaDescription}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-zinc-300">
              <Link href={`/category/${featured.category}`} className="rounded-full border border-white/15 px-3 py-1.5 text-white">
                {featured.category === "tech" ? "AI + PM" : "History + Lessons"}
              </Link>
              <span>{featured.readingTimeMinutes} min read</span>
            </div>
            <Link href={`/blog/${featured.slug}`} className="mt-8 inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-zinc-950">
              Read featured story
            </Link>
          </article>

          <aside className="rounded-[2rem] border border-zinc-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Editorial Tracks</p>
            <div className="mt-5 space-y-3">
              <Link href="/category/tech" className="block rounded-2xl border border-zinc-200 p-4 hover:border-teal-300 hover:bg-teal-50/40">
                <p className="font-medium text-zinc-950">AI + PM</p>
                <p className="mt-1 text-sm text-zinc-600">News, launches, impact analysis, future scenarios, and PM playbooks.</p>
              </Link>
              <Link href="/category/history" className="block rounded-2xl border border-zinc-200 p-4 hover:border-teal-300 hover:bg-teal-50/40">
                <p className="font-medium text-zinc-950">History + Lessons</p>
                <p className="mt-1 text-sm text-zinc-600">Historical events and strategic lessons that still apply in AI-era decisions.</p>
              </Link>
            </div>
          </aside>
        </section>
      ) : null}

      <section className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rest.map((article) => (
          <article key={article._id.toString()} className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
              <Link href={`/category/${article.category}`} className="hover:text-zinc-950">
                {article.category === "tech" ? "AI + PM" : "History + Lessons"}
              </Link>
              <span>{article.readingTimeMinutes} min read</span>
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">
              <Link href={`/blog/${article.slug}`} className="hover:text-teal-700">
                {article.title}
              </Link>
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{article.metaDescription}</p>
            <div className="mt-5 flex items-center justify-between text-sm text-zinc-500">
              <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-IN") : "Freshly published"}</span>
              <Link href={`/blog/${article.slug}`} className="font-medium text-teal-700">
                Read article
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
