import OpenAI from "openai";

import { extractJson } from "@/lib/utils/json";

type GenerateArticleInput = {
  title: string;
  keywords: string[];
  category: "tech" | "history";
  questions?: string[];
};

type GenerateArticleOutput = {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
};

type FaqEntry = {
  question: string;
  answer: string;
};

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY ?? "").trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL ?? "gpt-4.1-mini").trim();
const MIN_FAQ_COUNT = 5;

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function ensureQuestionMark(value: string) {
  const trimmed = value.trim();
  return /[?]$/.test(trimmed) ? trimmed : `${trimmed}?`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFallbackQuestions(input: GenerateArticleInput) {
  const topic = input.title.trim();
  const primaryKeyword = input.keywords[0]?.trim() || topic;
  const audience = input.category === "history" ? "today's builders and operators" : "product teams and operators";

  return [
    `What is the main takeaway from ${topic}?`,
    `Why does ${primaryKeyword} matter right now?`,
    `What risks should ${audience} watch closely?`,
    `How can teams apply these lessons in practice?`,
    `What should readers monitor next in this area?`,
    `How does this topic affect long-term strategy?`,
  ];
}

function buildAnswer(question: string, input: GenerateArticleInput) {
  const keywordList = input.keywords.slice(0, 3).join(", ") || input.title;
  const lowerQuestion = question.toLowerCase();

  if (lowerQuestion.startsWith("why")) {
    return `${input.title} matters now because shifts in ${keywordList} are changing how decisions get made. The immediate value is understanding where the momentum is real, where it is overhyped, and what actions are worth taking in the near term.`;
  }

  if (lowerQuestion.startsWith("how")) {
    return `The practical approach is to translate the article's lessons into a small set of decisions: what to invest in, what to delay, and what to measure. Teams should test the ideas in a narrow workflow first, then expand only when the signal is strong.`;
  }

  if (lowerQuestion.startsWith("what risks") || lowerQuestion.includes("risk")) {
    return `The main risks are misreading short-term momentum as durable value, overcommitting resources too early, and ignoring execution constraints. A disciplined view of market timing, user demand, and operating capacity reduces those risks.`;
  }

  if (lowerQuestion.startsWith("what should readers monitor") || lowerQuestion.includes("monitor next")) {
    return `Readers should watch product adoption, cost curves, regulatory signals, and whether real customer behavior matches the narrative. The next inflection point usually shows up in execution metrics before it shows up in headlines.`;
  }

  if (lowerQuestion.startsWith("what is") || lowerQuestion.startsWith("what are") || lowerQuestion.startsWith("what does")) {
    return `${input.title} is best understood as a signal about how ${keywordList} is evolving. The core takeaway is not just the event itself, but the pattern behind it and the decisions it should inform now.`;
  }

  return `The article points to a simple conclusion: durable advantage comes from linking insight to execution. In practice, that means using the lessons around ${keywordList} to make clearer, faster, and more grounded strategic choices.`;
}

function buildFaqEntries(input: GenerateArticleInput) {
  const sourceQuestions = dedupeStrings([
    ...(input.questions ?? []).map(ensureQuestionMark),
    ...getFallbackQuestions(input).map(ensureQuestionMark),
  ]).slice(0, MIN_FAQ_COUNT);

  return sourceQuestions.map((question) => ({
    question,
    answer: buildAnswer(question, input),
  }));
}

function getFaqSectionInfo(content: string) {
  const faqHeadingMatch = content.match(/<h2[^>]*>\s*(faq|faqs|frequently asked questions)\s*<\/h2>/i);
  if (!faqHeadingMatch || faqHeadingMatch.index === undefined) {
    return { hasSection: false, questionCount: 0 };
  }

  const startIndex = faqHeadingMatch.index;
  const remaining = content.slice(startIndex + faqHeadingMatch[0].length);
  const nextHeadingIndex = remaining.search(/<h2[^>]*>/i);
  const faqBlock = nextHeadingIndex >= 0 ? remaining.slice(0, nextHeadingIndex) : remaining;
  const questionCount = (faqBlock.match(/<h3[^>]*>/gi) ?? []).length;

  return { hasSection: true, questionCount };
}

function buildFaqHtml(entries: FaqEntry[]) {
  const mainEntity = entries.map((entry) => ({
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: entry.answer,
    },
  }));

  const itemsHtml = entries
    .map(
      (entry) =>
        `<div class="faq-item"><h3>${escapeHtml(entry.question)}</h3><p>${escapeHtml(entry.answer)}</p></div>`
    )
    .join("");

  return [
    `<section class="faq-section"><h2>Frequently Asked Questions</h2>${itemsHtml}</section>`,
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity,
    })}</script>`,
  ].join("");
}

function ensureFaqSection(content: string, input: GenerateArticleInput) {
  const faqInfo = getFaqSectionInfo(content);
  if (faqInfo.hasSection && faqInfo.questionCount >= MIN_FAQ_COUNT) {
    return content;
  }

  const faqHtml = buildFaqHtml(buildFaqEntries(input));
  return `${content.trim()}\n\n${faqHtml}`;
}

export async function generateArticle(
  input: GenerateArticleInput
): Promise<GenerateArticleOutput> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are a senior publication writer focused on AI trends and product management career insights. Return only valid JSON and no extra text.",
      },
      {
        role: "user",
        content: `Write an SEO-optimized article with publication-grade copy.\n\nRequirements:\n- 1200-1500 words\n- Valid HTML content\n- Use semantic headings with one <h1> and multiple <h2>/<h3>\n- Include exactly one FAQ section near the end of the article\n- The FAQ section must contain at least 5 question-and-answer pairs\n- Use <h2>Frequently Asked Questions</h2> for the FAQ heading\n- Use one <h3> per FAQ question followed by a concise answer paragraph\n- Keep readability high and practical\n- Explain what changed, why it matters, and what to do next\n- If relevant, include a short "Implications for Product Managers" section\n\nTitle: ${input.title}\nCategory: ${input.category}\nKeywords: ${input.keywords.join(", ")}\nSERP questions: ${(input.questions ?? []).join(" | ")}\n\nReturn JSON:\n{\n  \"title\": string,\n  \"content\": string,\n  \"metaTitle\": string,\n  \"metaDescription\": string\n}`,
      },
    ],
    temperature: 0.6,
  });

  const parsed = extractJson<GenerateArticleOutput>(response.output_text);
  const content = ensureFaqSection(parsed.content, input);

  return {
    title: parsed.title?.trim() || input.title,
    content,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
  };
}
