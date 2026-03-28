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
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:py-16">
      {/* Page Header */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] md:rounded-3xl md:px-10 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Latest Stories</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950 md:text-5xl">
          AI news, future impact, historical context, and PM career insights.
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 md:text-lg md:leading-8">
          Editorially focused posts for builders, operators, and Product Managers navigating fast AI change.
        </p>
      </section>

      {/* Featured Article */}
      {featured ? (
        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_300px]">
          <article className="rounded-2xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-[0_28px_100px_rgba(15,23,42,0.2)] md:rounded-3xl md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">Featured Story</p>
            <h2 className="mt-5 text-2xl font-bold tracking-tight md:text-4xl">
              <Link href={`/blog/${featured.slug}`} className="hover:text-teal-300">
                {featured.title}
              </Link>
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-300">{featured.metaDescription}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
              <Link href={`/category/${featured.category}`} className="rounded-lg border border-white/15 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-white/10">
                {featured.category === "tech" ? "AI + PM" : "History + Lessons"}
              </Link>
              <span>{featured.readingTimeMinutes} min read</span>
            </div>
            <Link href={`/blog/${featured.slug}`} className="mt-8 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-100">
              Read featured story →
            </Link>
          </article>

          {/* Editorial Tracks Sidebar */}
          <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)] md:rounded-3xl md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Editorial Tracks</p>
            <div className="mt-4 space-y-3 md:mt-6 md:space-y-4">
              <Link href="/category/tech" className="block rounded-xl border border-zinc-200 p-4 transition-all hover:border-teal-300 hover:bg-teal-50/40">
                <p className="font-semibold text-zinc-950">AI + PM</p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">News, launches, impact analysis, future scenarios, and PM playbooks.</p>
              </Link>
              <Link href="/category/history" className="block rounded-xl border border-zinc-200 p-4 transition-all hover:border-teal-300 hover:bg-teal-50/40">
                <p className="font-semibold text-zinc-950">History + Lessons</p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">Historical events and strategic lessons that apply in AI-era decisions.</p>
              </Link>
            </div>
          </aside>
        </section>
      ) : null}

      {/* Article Grid */}
      <section className="mt-10 grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((article) => (
          <article key={article._id.toString()} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.04)] transition-all hover:border-teal-300 hover:shadow-[0_20px_70px_rgba(20,184,166,0.08)] md:rounded-2xl md:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Link href={`/category/${article.category}`} className="hover:text-zinc-950">
                {article.category === "tech" ? "AI + PM" : "History + Lessons"}
              </Link>
              <span>•</span>
              <span>{article.readingTimeMinutes} min</span>
            </div>

            <h3 className="mt-4 text-lg font-bold tracking-tight text-zinc-950 md:text-xl">
              <Link href={`/blog/${article.slug}`} className="hover:text-teal-700">
                {article.title}
              </Link>
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{article.metaDescription}</p>
            <div className="mt-5 flex items-center justify-between text-xs text-zinc-500 md:text-sm">
              <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-US", { month: 'short', day: 'numeric' }) : "Just published"}</span>
              <Link href={`/blog/${article.slug}`} className="font-semibold text-teal-700 hover:text-teal-800">
                Read →
              </Link>
            </div>
          </article>
        ))}
      </section>

      {rest.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <p className="text-zinc-600">No more stories yet. Check back soon for fresh content.</p>
        </div>
      )}
    </main>
  );
}
