"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Cluster = {
  _id: string;
  baseTopic: string;
  keywords: string[];
  questions: string[];
  generatedTitles: string[];
  category: "tech" | "history";
  createdAt: string;
};

type Article = {
  _id: string;
  title: string;
  slug: string;
  content: string;
  category: "tech" | "history";
  status: "draft" | "approved" | "rejected" | "published";
  metaTitle: string;
  metaDescription: string;
  clusterId: { _id: string; baseTopic?: string } | string;
  publishedAt?: string | null;
  updatedAt?: string;
};

type AnalyticsCluster = {
  clusterId: string;
  baseTopic: string;
  category: "tech" | "history";
  totalArticles: number;
  statusCounts: {
    draft: number;
    approved: number;
    rejected: number;
    published: number;
  };
  lastPublishedAt: string | null;
};

type Analytics = {
  overview: {
    totalClusters: number;
    totalArticles: number;
    totalPublished: number;
    totalDrafts: number;
  };
  clusters: AnalyticsCluster[];
};

type LinkSuggestion = {
  targetArticleId: string;
  slug: string;
  title: string;
  anchorText: string;
  reason: string;
};

type TopicIdea = {
  baseTopic: string;
  angle: string;
  whyNow: string;
  category: "tech" | "history";
};

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [topic, setTopic] = useState("");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([]);
  const [autoIdeas, setAutoIdeas] = useState<TopicIdea[]>([]);
  const [saving, setSaving] = useState(false);
  const [discoveringIdeas, setDiscoveringIdeas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    const [clustersRes, articlesRes, analyticsRes] = await Promise.all([
      fetch("/api/cluster", { credentials: "include" }),
      fetch("/api/articles", { credentials: "include" }),
      fetch("/api/admin/analytics", { credentials: "include" }),
    ]);

    if (
      clustersRes.status === 401 ||
      articlesRes.status === 401 ||
      analyticsRes.status === 401
    ) {
      const meRes = await fetch("/api/admin/me", { credentials: "include" });
      if (!meRes.ok) {
        setIsLoggedIn(false);
      }
      return;
    }

    if (!clustersRes.ok || !articlesRes.ok || !analyticsRes.ok) {
      setError("Failed to load admin data. Please retry in a moment.");
      setClusters([]);
      setArticles([]);
      setAnalytics(null);
      return;
    }

    const clustersData = await clustersRes.json();
    const articlesData = await articlesRes.json();
    const analyticsData = await analyticsRes.json();

    setError(null);
    setClusters(clustersData.clusters ?? []);
    setArticles(articlesData.articles ?? []);
    setAnalytics(analyticsData?.overview ? analyticsData : null);
  }

  async function discoverIdeas() {
    setDiscoveringIdeas(true);
    setError(null);

    const res = await fetch("/api/ideas/auto", { credentials: "include" });

    setDiscoveringIdeas(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to generate automated ideas");
      return;
    }

    const data = await res.json();
    setAutoIdeas(data.ideas ?? []);
  }

  async function loadLinkSuggestions(articleId: string) {
    const res = await fetch(`/api/articles/${articleId}/internal-links`, {
      credentials: "include",
    });

    if (!res.ok) {
      setLinkSuggestions([]);
      return;
    }

    const data = await res.json();
    setLinkSuggestions(data.suggestions ?? []);
  }

  useEffect(() => {
    async function checkSession() {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      setIsLoggedIn(res.ok);
      if (res.ok) {
        await Promise.all([loadData(), discoverIdeas()]);
      }
      setAuthChecked(true);
    }

    void checkSession();
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });

    if (!res.ok) {
      setError("Invalid admin password");
      return;
    }

    setIsLoggedIn(true);
    setPassword("");
    await Promise.all([loadData(), discoverIdeas()]);
  }

  async function generateCluster(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/cluster/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseTopic: topic }),
      credentials: "include",
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to generate cluster");
      return;
    }

    setTopic("");
    await loadData();
  }

  async function generateArticle(clusterId: string, title: string, publishToDevto = false) {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/article/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clusterId, title, autoPublish: true, publishToDevto }),
      credentials: "include",
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to generate article");
      return;
    }

    await loadData();
  }

  async function autoPublishCluster(cluster: Cluster, count = 3) {
    setSaving(true);
    setError(null);

    try {
      for (const title of cluster.generatedTitles.slice(0, count)) {
        const res = await fetch("/api/article/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clusterId: cluster._id,
            title,
            autoPublish: true,
          }),
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to publish ${title}`);
        }
      }

      await loadData();
    } catch (autoPublishError) {
      setError(
        autoPublishError instanceof Error
          ? autoPublishError.message
          : "Failed to auto-publish cluster"
      );
    } finally {
      setSaving(false);
    }
  }

  async function runAutoPipeline(baseTopic?: string) {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/pipeline/auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseTopic, articleCount: 3 }),
      credentials: "include",
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to run automated pipeline");
      return;
    }

    await Promise.all([loadData(), discoverIdeas()]);
  }

  async function saveArticle() {
    if (!selectedArticle) {
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch(`/api/articles/${selectedArticle._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selectedArticle.title,
        content: selectedArticle.content,
        metaTitle: selectedArticle.metaTitle,
        metaDescription: selectedArticle.metaDescription,
        status: selectedArticle.status,
      }),
      credentials: "include",
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update article");
      return;
    }

    await loadData();
  }

  async function publish(articleId: string, devto: boolean) {
    setSaving(true);
    setError(null);

    const query = devto ? "?devto=true" : "";
    const res = await fetch(`/api/articles/${articleId}/publish${query}`, {
      method: "POST",
      credentials: "include",
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to publish article");
      return;
    }

    await loadData();
  }

  async function seedDemoData() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/seed", {
      method: "POST",
      credentials: "include",
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to seed demo data");
      return;
    }

    await loadData();
  }

  const clusterMap = useMemo(() => {
    const grouped = new Map<string, Article[]>();

    for (const article of articles) {
      const key =
        typeof article.clusterId === "string" ? article.clusterId : article.clusterId._id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(article);
    }

    return grouped;
  }, [articles]);

  if (!isLoggedIn) {
    if (!authChecked) {
      return (
        <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-6 py-12">
          <div className="w-full rounded-[1.5rem] border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
            Checking admin session...
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-6 py-12">
        <form onSubmit={login} className="w-full rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
          <h1 className="text-2xl font-semibold tracking-tight">Admin Login</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Login once, then use automation to discover ideas and auto-publish posts.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="Admin password"
            required
          />
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-zinc-950 px-3 py-2 text-white"
          >
            Login
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Content Engine Admin</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            The default workflow is now automated: discover ideas from your project
            profile, generate cluster content, and publish without approving each
            article one by one.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
            setIsLoggedIn(false);
          }}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm"
        >
          Logout
        </button>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                Auto Mode
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Automated Topic Discovery</h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={discoverIdeas}
                disabled={discoveringIdeas || saving}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm disabled:opacity-60"
              >
                {discoveringIdeas ? "Refreshing..." : "Refresh Ideas"}
              </button>
              <button
                type="button"
                onClick={() => runAutoPipeline()}
                disabled={saving}
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Run Auto Batch
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Ideas are generated from the publication theme engine, recent topics already
            published, and your configured editorial pillars.
          </p>

          <div className="mt-5 grid gap-4">
            {autoIdeas.map((idea) => (
              <div key={idea.baseTopic} className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-950">{idea.baseTopic}</p>
                    <p className="mt-1 text-sm text-zinc-600">{idea.angle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runAutoPipeline(idea.baseTopic)}
                    disabled={saving}
                    className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Publish 3 Posts
                  </button>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {idea.category} • {idea.whyNow}
                </p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={generateCluster} className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                Manual Override
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Generate a Specific Cluster</h2>
            </div>
            <button
              type="button"
              onClick={seedDemoData}
              disabled={saving}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm disabled:opacity-60"
            >
              Seed Demo Data
            </button>
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Use this only when you want to force a topic. Otherwise, rely on Auto Mode
            above and let the system discover ideas for you.
          </p>

          <div className="mt-5 flex gap-3">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              placeholder="Example: AI analytics for founders"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-zinc-950 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              Build Cluster
            </button>
          </div>
        </form>
      </section>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      {analytics ? (
        <section className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
          <h2 className="text-xl font-semibold">Publishing Analytics</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Clusters</p>
              <p className="mt-2 text-3xl font-semibold">{analytics.overview.totalClusters}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Articles</p>
              <p className="mt-2 text-3xl font-semibold">{analytics.overview.totalArticles}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Published</p>
              <p className="mt-2 text-3xl font-semibold">{analytics.overview.totalPublished}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Drafts</p>
              <p className="mt-2 text-3xl font-semibold">{analytics.overview.totalDrafts}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Clusters and Titles</h2>
            <p className="text-sm text-zinc-500">Default action is now generate + publish.</p>
          </div>

          {clusters.map((cluster) => {
            const clusterArticles = clusterMap.get(cluster._id) ?? [];

            return (
              <div key={cluster._id} className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-950">{cluster.baseTopic}</h3>
                    <p className="mt-2 text-sm text-zinc-600">
                      {cluster.keywords.slice(0, 8).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-zinc-700">
                      {cluster.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => autoPublishCluster(cluster)}
                      disabled={saving}
                      className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Auto Publish Top 3
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {clusterArticles.length} articles in cluster • {clusterArticles.filter((item) => item.status === "published").length} published
                </p>

                <div className="mt-4 space-y-2">
                  {cluster.generatedTitles.map((title) => (
                    <div key={title} className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 p-3">
                      <p className="text-sm text-zinc-800">{title}</p>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-teal-700 px-3 py-1.5 text-xs font-medium text-white"
                          onClick={() => generateArticle(cluster._id, title)}
                        >
                          Generate + Publish
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700"
                          onClick={() => generateArticle(cluster._id, title, true)}
                        >
                          + Dev.to
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <h2 className="text-xl font-semibold">Content Library</h2>
          <div className="mt-4 space-y-3">
            {articles.map((article) => (
              <button
                type="button"
                key={article._id}
                onClick={async () => {
                  setSelectedArticle(article);
                  await loadLinkSuggestions(article._id);
                }}
                className="w-full rounded-[1.5rem] border border-zinc-200 bg-white p-4 text-left shadow-[0_16px_50px_rgba(15,23,42,0.04)]"
              >
                <p className="font-medium text-zinc-900">{article.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {article.status} • {article.category}
                </p>
                {article.publishedAt ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Published: {new Date(article.publishedAt).toLocaleDateString("en-IN")}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      {selectedArticle ? (
        <section className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
          <h2 className="text-xl font-semibold">Edit and Republish</h2>
          <div className="mt-4 grid gap-3">
            <input
              value={selectedArticle.title}
              onChange={(e) =>
                setSelectedArticle({ ...selectedArticle, title: e.target.value })
              }
              className="rounded-lg border border-zinc-300 px-3 py-2"
            />
            <input
              value={selectedArticle.metaTitle}
              onChange={(e) =>
                setSelectedArticle({ ...selectedArticle, metaTitle: e.target.value })
              }
              className="rounded-lg border border-zinc-300 px-3 py-2"
            />
            <textarea
              value={selectedArticle.metaDescription}
              onChange={(e) =>
                setSelectedArticle({ ...selectedArticle, metaDescription: e.target.value })
              }
              className="rounded-lg border border-zinc-300 px-3 py-2"
              rows={2}
            />
            <textarea
              value={selectedArticle.content}
              onChange={(e) =>
                setSelectedArticle({ ...selectedArticle, content: e.target.value })
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
              rows={14}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveArticle}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm"
              disabled={saving}
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => publish(selectedArticle._id, false)}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm text-white"
              disabled={saving}
            >
              Publish Internal
            </button>
            <button
              type="button"
              onClick={() => publish(selectedArticle._id, true)}
              className="rounded-full bg-teal-700 px-4 py-2 text-sm text-white"
              disabled={saving}
            >
              Publish + Dev.to
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-700">
              Internal Link Suggestions
            </h3>
            {linkSuggestions.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600">
                No sibling articles found for this cluster yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {linkSuggestions.map((item) => (
                  <div key={item.targetArticleId} className="rounded-xl border border-zinc-200 bg-white p-3">
                    <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-600">Suggested anchor: &quot;{item.anchorText}&quot;</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.reason}</p>
                    <p className="mt-1 text-xs text-zinc-500">Target URL: /blog/{item.slug}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
