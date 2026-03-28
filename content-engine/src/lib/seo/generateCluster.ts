import OpenAI from "openai";

import type { SerpResearch } from "@/lib/seo/serp";
import { extractJson } from "@/lib/utils/json";
import type { TopicCategory } from "@/models/TopicCluster";

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY ?? "").trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL ?? "gpt-4.1-mini").trim();

type ClusterOutput = {
  titles: string[];
  keywords: string[];
  category: TopicCategory;
};

export async function generateCluster(
  baseTopic: string,
  serpData: SerpResearch
): Promise<ClusterOutput> {
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
          "You are an SEO strategist for an AI-and-product publication. Return only valid JSON and no extra text.",
      },
      {
        role: "user",
        content: `Base topic: ${baseTopic}\n\nSERP research:\n${JSON.stringify(
          serpData,
          null,
          2
        )}\n\nCreate a topic cluster focused on these editorial themes:\n- AI news, launches, impact, and future scenarios\n- Historical events connected to current technology decisions\n- Career building for Product Managers in the AI era\n\nRequirements:\n- 5 to 10 specific blog titles\n- keyword list aligned to search intent\n- category: tech or history\n\nOutput JSON format:\n{\n  "titles": string[],\n  "keywords": string[],\n  "category": "tech" | "history"\n}`,
      },
    ],
    temperature: 0.4,
  });

  const parsed = extractJson<ClusterOutput>(response.output_text);

  return {
    titles: (parsed.titles ?? []).slice(0, 10),
    keywords: dedupe(parsed.keywords ?? []).slice(0, 20),
    category: parsed.category === "history" ? "history" : "tech",
  };
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}
