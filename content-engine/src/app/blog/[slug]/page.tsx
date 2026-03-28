import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import FAQSection from "@/components/FAQSection";
import { blogTheme } from "@/lib/config/blogTheme";
import { getPublishedArticleBySlug, getPublishedArticles } from "@/lib/services/content";
import {
  extractFAQsFromContent,
  removeFAQSectionFromContent,
  removeLdJsonFromContent,
  extractLdJsonFromContent,
} from "@/lib/utils/faqExtractor";

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

  // Extract FAQs and remove from article content
  const faqs = extractFAQsFromContent(article.content);
  const cleanContent = removeFAQSectionFromContent(article.content);
  const ldJsonSchema = extractLdJsonFromContent(article.content);
  const contentWithoutLdJson = removeLdJsonFromContent(cleanContent);

  const related = (await getPublishedArticles())
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 md:py-16">
      {/* Article Header */}
      <header className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] md:rounded-3xl md:px-10 md:py-10">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 md:gap-3 md:text-sm">
          <Link href="/blog" className="font-semibold text-zinc-700 hover:text-zinc-950">
            Latest
          </Link>
          <span>/</span>
          <Link href={`/category/${article.category}`} className="hover:text-zinc-950">
            {article.category === "tech" ? "AI + PM" : "History + Lessons"}
          </Link>
          <span className="rounded-lg bg-teal-50 px-2.5 py-1 font-semibold uppercase tracking-wider text-teal-700 md:px-3 md:py-1.5">
            {article.readingTimeMinutes} min
          </span>
        </nav>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-950 md:text-5xl">
          {article.title}
        </h1>

        <p className="mt-4 text-base leading-7 text-zinc-600 md:max-w-3xl md:text-lg md:leading-8">
          {article.metaDescription}
        </p>

        <p className="mt-5 text-xs text-zinc-500 md:text-sm">
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "Recently published"}
        </p>
      </header>

      {/* Article Body */}
      <article
        className="prose prose-zinc mt-8 max-w-none rounded-2xl border border-zinc-200 bg-white px-6 py-8 prose-headings:mt-6 prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:mb-4 prose-p:text-base prose-p:text-zinc-700 prose-p:leading-7 prose-li:mb-2 prose-li:text-zinc-700 prose-a:font-semibold prose-a:text-teal-700 prose-a:no-underline hover:prose-a:underline prose-strong:font-bold prose-strong:text-zinc-950 md:rounded-3xl md:px-10 md:py-10"
        dangerouslySetInnerHTML={{ __html: contentWithoutLdJson }}
      />

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <div className="mt-10 md:mt-12">
          <FAQSection faqs={faqs} />
        </div>
      )}

      {/* LD+JSON Schema (for SEO) */}
      {ldJsonSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJsonSchema) }}
        />
      )}

      {/* Related Articles Sidebar */}
      {related.length > 0 && (
        <aside className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)] md:mt-12 md:rounded-3xl md:p-8">
          <h3 className="text-lg font-bold tracking-tight text-zinc-950 md:text-xl">
            Related reads
          </h3>
          <div className="mt-4 space-y-3 md:mt-6 md:space-y-4">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/blog/${item.slug}`}
                className="block rounded-xl border border-zinc-200 p-4 transition-all hover:border-teal-300 hover:bg-teal-50/40"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {item.category === "tech" ? "AI + PM" : "History + Lessons"}
                </p>
                <p className="mt-2 font-semibold text-zinc-900">{item.title}</p>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </main>
  );
}
