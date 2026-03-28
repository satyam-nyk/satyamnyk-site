import OpenAI from "openai";

import { blogTheme } from "@/lib/config/blogTheme";
import { extractJson } from "@/lib/utils/json";
import type { TopicCategory } from "@/models/TopicCluster";

type TopicIdea = {
  baseTopic: string;
  angle: string;
  whyNow: string;
  category: TopicCategory;
};

type TopicIdeasOutput = {
  ideas: TopicIdea[];
};

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY ?? "").trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL ?? "gpt-4.1-mini").trim();

export async function generateTopicIdeas(
  recentTopics: string[] = []
): Promise<TopicIdea[]> {
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
          "You are an editorial strategist for a niche publication. Return only valid JSON.",
      },
      {
        role: "user",
        content: `Publication theme:\n${JSON.stringify(blogTheme, null, 2)}\n\nRecent topics to avoid repeating:\n${JSON.stringify(
          recentTopics,
          null,
          2
        )}\n\nGenerate 6 blog base-topic ideas for this publication. Required mix:\n- 3 ideas around AI news/new launches/impact/future\n- 1 idea around historical event(s) and what they teach now\n- 2 ideas around career building for Product Managers (general + AI era)\n\nEach idea should be broad enough to support a cluster and timely enough to publish now. Use clear editorial language, not generic topic names.\n\nReturn JSON in this format:\n{\n  "ideas": [\n    {\n      "baseTopic": string,\n      "angle": string,\n      "whyNow": string,\n      "category": "tech" | "history"\n    }\n  ]\n}`,
      },
    ],
    temperature: 0.7,
  });

  const parsed = extractJson<TopicIdeasOutput>(response.output_text);

  return (parsed.ideas ?? [])
    .map((idea) => ({
      baseTopic: idea.baseTopic?.trim(),
      angle: idea.angle?.trim(),
      whyNow: idea.whyNow?.trim(),
      category: idea.category === "history" ? "history" : "tech",
    }))
    .filter(
      (idea): idea is TopicIdea =>
        Boolean(idea.baseTopic && idea.angle && idea.whyNow)
    );
}

export type { TopicIdea };
