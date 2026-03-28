import Link from "next/link";

import { blogTheme } from "@/lib/config/blogTheme";
import { getPublishedArticles } from "@/lib/services/content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const latestArticles = (await getPublishedArticles()).slice(0, 4);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-12 md:py-16">
      <section className="rounded-[2rem] border border-zinc-200 bg-white px-8 py-10 shadow-[0_30px_110px_rgba(15,23,42,0.08)] md:px-12 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Editorial Brief
        </p>
        <h1 className="mt-4 max-w-5xl text-4xl font-semibold tracking-tight text-zinc-950 md:text-6xl">
          {blogTheme.publicationName}
        </h1>
        <p className="mt-5 max-w-4xl text-base leading-8 text-zinc-600 md:text-lg">
          {blogTheme.tagline}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/blog" className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white">
            Read latest posts
          </Link>
          <Link href="/category/tech" className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700">
            AI + PM tracks
          </Link>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Theme 01</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">AI News and Change</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            New model launches, platform updates, major partnerships, and what changed in
            practical terms.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Theme 02</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">Impact and Future</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            How AI affects products, teams, careers, and decision-making, plus likely next
            scenarios.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Theme 03</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">History and PM Career</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Historical parallels that sharpen judgment, and practical career playbooks for
            Product Managers in the AI era.
          </p>
        </article>
      </section>

      <section className="mt-12 rounded-[2rem] border border-zinc-200 bg-zinc-950 px-8 py-10 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-teal-300">
          Automated Editorial System
        </p>
        <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
          Topic discovery, cluster planning, article generation, and auto-publishing.
        </h2>
        <p className="mt-4 max-w-3xl text-zinc-300">
          The engine discovers topics from this editorial theme, builds cluster titles,
          generates long-form posts, and publishes batches automatically.
        </p>
      </section>

      <section className="mt-12 rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Latest Stories</h2>
          <Link href="/blog" className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700">
            View all
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {latestArticles.length > 0 ? (
            latestArticles.map((article) => (
              <Link key={article.slug} href={`/blog/${article.slug}`} className="rounded-2xl border border-zinc-200 p-5 hover:border-teal-300 hover:bg-teal-50/40">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <span>{article.category === "tech" ? "AI + PM" : "History + Lessons"}</span>
                  <span>{article.readingTimeMinutes} min read</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">{article.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{article.metaDescription}</p>
              </Link>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-zinc-300 p-5 text-sm leading-6 text-zinc-600 md:col-span-2">
              No published stories yet. Run an auto batch from admin to generate the first set.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
