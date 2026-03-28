export const blogTheme = {
  publicationName: "AI Product Signals",
  tagline: "AI news, future impact, historical context, and PM career playbooks.",
  metaDescription:
    "A focused publication on AI trends, emerging tools, future impact, historical lessons, and career building for Product Managers in the AI era.",
  pillars: [
    "AI news and product updates",
    "new AI tools and what changed",
    "impact of AI on users, teams, and businesses",
    "future scenarios and strategic implications",
    "historical events and lessons for modern technology",
    "career building as a Product Manager in general and in the AI era",
  ],
  preferredAngles: [
    "explain what happened",
    "explain why it matters",
    "predict what might happen next",
    "show practical action items for PMs",
  ],
  settings: {
    articlesPerBatch: 3,
    publishToDevtoByDefault: false,
  },
};

export type BlogTheme = typeof blogTheme;