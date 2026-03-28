# Content Engine

Content Engine is an AI-powered SEO content pipeline MVP.

Core principle: one SERP call per topic cluster, then generate multiple article ideas and articles from that shared research context.

## Stack

- Next.js (App Router)
- Tailwind CSS
- MongoDB + Mongoose
- OpenAI API
- SerpAPI
- Dev.to API

## Features

- Topic cluster generation from one base topic
- SERP extraction: related searches, people also ask, suggestions
- 5-10 blog title ideas per cluster
- SEO article generation (1200-1500 words, HTML output)
- Admin review system (draft, approved, rejected, published)
- Internal blog publishing
- Dev.to publishing with canonical URL

## Project Structure

```text
src/
	app/
		blog/
		category/[category]/
		admin/
		api/
			cluster/
			article/
			articles/
			admin/
	lib/
		ai/
		seo/
		devto/
		services/
		utils/
	models/
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local` values:

- `OPENAI_API_KEY`
- `SERPAPI_API_KEY`
- `DEVTO_API_KEY`
- `MONGODB_URI`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL`

4. Run development server:

```bash
npm run dev
```

## Vercel Automation

Use these variables in `.env.local`:

- `VERCEL_API_TOKEN`
- `VERCEL_ORG_ID` (optional)
- `VERCEL_PROJECT_ID` (optional)

Then run:

```bash
npm run vercel:env:push
```

This syncs values from `.env.local` to Vercel production environment.

Deploy to production:

```bash
npm run vercel:deploy
```

Do both in one command:

```bash
npm run vercel:ship
```

## API Routes

- `POST /api/cluster/generate`
- `GET /api/cluster`
- `POST /api/article/generate`
- `GET /api/articles`
- `PUT /api/articles/:id`
- `POST /api/articles/:id/publish`

## Flow

1. Input base topic in admin.
2. System performs one SerpAPI call.
3. OpenAI generates cluster titles and keywords.
4. User generates one or more articles from cluster titles.
5. User edits and approves/rejects drafts.
6. User publishes to internal blog and optionally Dev.to.
