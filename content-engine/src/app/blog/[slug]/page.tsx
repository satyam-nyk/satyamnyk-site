import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { blogTheme } from "@/lib/config/blogTheme";
import { getPublishedArticleBySlug, getPublishedArticles } from "@/lib/services/content";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article Not Found",
    };
  }

  return {
    title: article.metaTitle,
    description: article.metaDescription,
  };
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const related = (await getPublishedArticles())
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="rounded-[2rem] border border-zinc-200 bg-white px-7 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] md:px-10 md:py-10">
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              <Link href="/blog" className="font-medium text-zinc-700 hover:text-zinc-950">
                Latest
              </Link>
              <span>/</span>
              <Link href={`/category/${article.category}`} className="hover:text-zinc-950">
                {article.category === "tech" ? "AI + PM" : "History + Lessons"}
              </Link>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                {article.readingTimeMinutes} min read
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-950 md:text-6xl">
              {article.title}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-600">
              {article.metaDescription}
            </p>
            <p className="mt-5 text-sm text-zinc-500">
              {article.publishedAt
                ? new Date(article.publishedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Recently published"}
            </p>
          </div>

          <article
            className="prose prose-zinc mt-8 max-w-none rounded-[2rem] border border-zinc-200 bg-white px-7 py-8 prose-headings:tracking-tight prose-a:text-teal-700 md:px-10 md:py-10"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </section>

        <aside className="space-y-6">
          <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              Publication
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">{blogTheme.publicationName}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{blogTheme.metaDescription}</p>
            <Link href="/blog" className="mt-5 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white">
              Browse latest posts
            </Link>
          </section>

          <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Related reads
            </h3>
            <div className="mt-4 space-y-4">
              {related.map((item) => (
                <Link key={item.slug} href={`/blog/${item.slug}`} className="block rounded-2xl border border-zinc-200 p-4 hover:border-teal-300 hover:bg-teal-50/40">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{item.category === "tech" ? "AI + PM" : "History + Lessons"}</p>
                  <p className="mt-2 font-medium text-zinc-900">{item.title}</p>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
