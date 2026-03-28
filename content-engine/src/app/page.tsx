import Link from "next/link";

import { blogTheme } from "@/lib/config/blogTheme";
import { getPublishedArticles } from "@/lib/services/content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const latestArticles = (await getPublishedArticles()).slice(0, 4);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10 md:py-16">
      {/* Hero Section */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 shadow-[0_30px_110px_rgba(15,23,42,0.08)] md:rounded-3xl md:px-10 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Welcome
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
          AI Product Signals
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 md:text-lg">
          Signals, systems, and shifts across AI, product thinking, and history — structured for clarity, not noise.
        </p>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:gap-4">
          <Link href="/blog" className="rounded-lg bg-zinc-950 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-zinc-800 md:w-auto">
            Read latest posts
          </Link>
          <Link href="/category/tech" className="rounded-lg border border-zinc-300 px-6 py-3 text-center text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 md:w-auto">
            Explore AI + PM tracks
          </Link>
        </div>
      </section>

      {/* Content Pillars */}
      <section className="mt-12 grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Track 01</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 md:text-2xl">AI News and Change</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            New model launches, platform updates, major partnerships, and what changed in practical terms.
          </p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Track 02</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 md:text-2xl">Impact and Future</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            How AI affects products, teams, careers, and decision-making, plus likely next scenarios.
          </p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Track 03</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 md:text-2xl">History and PM Career</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Historical parallels that sharpen judgment, and practical career playbooks for PMs in the AI era.
          </p>
        </article>
      </section>

      {/* Latest Stories */}
      <section className="mt-12 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.05)] md:rounded-3xl md:p-8">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Latest Stories</h2>
          <Link href="/blog" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50">
            View all
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {latestArticles.length > 0 ? (
            latestArticles.map((article) => (
              <Link key={article.slug} href={`/blog/${article.slug}`} className="rounded-xl border border-zinc-200 p-5 transition-all hover:border-teal-300 hover:bg-teal-50/40">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500 md:gap-3">
                  <span>{article.category === "tech" ? "AI + PM" : "History + Lessons"}</span>
                  <span>•</span>
                  <span>{article.readingTimeMinutes} min read</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 md:text-xl">{article.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{article.metaDescription}</p>
              </Link>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm leading-6 text-zinc-600 md:col-span-2">
              No published stories yet. Run an auto batch to generate the first set.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
