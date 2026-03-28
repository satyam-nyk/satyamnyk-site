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

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY ?? "").trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL ?? "gpt-4.1-mini").trim();

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
        content: `Write an SEO-optimized article with publication-grade copy.\n\nRequirements:\n- 1200-1500 words\n- Valid HTML content\n- Use semantic headings with one <h1> and multiple <h2>/<h3>\n- Include FAQ section from provided questions\n- Keep readability high and practical\n- Explain what changed, why it matters, and what to do next\n- If relevant, include a short "Implications for Product Managers" section\n\nTitle: ${input.title}\nCategory: ${input.category}\nKeywords: ${input.keywords.join(", ")}\nSERP questions: ${(input.questions ?? []).join(" | ")}\n\nReturn JSON:\n{\n  \"title\": string,\n  \"content\": string,\n  \"metaTitle\": string,\n  \"metaDescription\": string\n}`,
      },
    ],
    temperature: 0.6,
  });

  const parsed = extractJson<GenerateArticleOutput>(response.output_text);

  return {
    title: parsed.title?.trim() || input.title,
    content: parsed.content,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
  };
}
