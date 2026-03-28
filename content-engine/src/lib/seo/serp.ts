import axios from "axios";

export type SerpResearch = {
  relatedSearches: string[];
  questions: string[];
  suggestions: string[];
};

type SerpApiResponse = {
  related_searches?: Array<{ query?: string }>;
  related_questions?: Array<{ question?: string }>;
  organic_results?: Array<{ title?: string }>;
};

const SERPAPI_API_KEY = (process.env.SERPAPI_API_KEY ?? "").trim();

export async function fetchSerpResearch(baseTopic: string): Promise<SerpResearch> {
  if (!SERPAPI_API_KEY) {
    throw new Error("SERPAPI_API_KEY is not set");
  }

  const { data } = await axios.get<SerpApiResponse>(
    "https://serpapi.com/search.json",
    {
      params: {
        engine: "google",
        q: baseTopic,
        num: 10,
        hl: "en",
        gl: "in",
        api_key: SERPAPI_API_KEY,
      },
      timeout: 20000,
    }
  );

  const relatedSearches = (data.related_searches ?? [])
    .map((item) => item.query?.trim())
    .filter((value): value is string => Boolean(value));

  const questions = (data.related_questions ?? [])
    .map((item) => item.question?.trim())
    .filter((value): value is string => Boolean(value));

  const suggestionsFromTitles = (data.organic_results ?? [])
    .map((item) => item.title?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);

  return {
    relatedSearches,
    questions,
    suggestions: dedupe([baseTopic, ...relatedSearches, ...suggestionsFromTitles]),
  };
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}
