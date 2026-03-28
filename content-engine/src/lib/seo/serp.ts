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
const SEARCHAPI_API_KEY = (process.env.SEARCHAPI_API_KEY ?? "").trim();

async function fetchFromSerpApi(baseTopic: string): Promise<SerpApiResponse> {
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
  return data;
}

async function fetchFromSearchApi(baseTopic: string): Promise<SerpApiResponse> {
  const { data } = await axios.get<SerpApiResponse>(
    "https://www.searchapi.io/api/v1/search",
    {
      params: {
        engine: "google",
        q: baseTopic,
        hl: "en",
        gl: "in",
        api_key: SEARCHAPI_API_KEY,
      },
      timeout: 20000,
    }
  );
  return data;
}

function parseResults(data: SerpApiResponse, baseTopic: string): SerpResearch {
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

export async function fetchSerpResearch(baseTopic: string): Promise<SerpResearch> {
  if (!SERPAPI_API_KEY && !SEARCHAPI_API_KEY) {
    throw new Error("No SERP API key is configured");
  }

  // Day-based rotation: even days → SerpAPI, odd days → SearchAPI
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const preferSerpApi = daysSinceEpoch % 2 === 0;

  type Fetcher = () => Promise<SerpApiResponse>;
  const [primary, fallback]: [Fetcher | null, Fetcher | null] = preferSerpApi
    ? [
        SERPAPI_API_KEY ? () => fetchFromSerpApi(baseTopic) : null,
        SEARCHAPI_API_KEY ? () => fetchFromSearchApi(baseTopic) : null,
      ]
    : [
        SEARCHAPI_API_KEY ? () => fetchFromSearchApi(baseTopic) : null,
        SERPAPI_API_KEY ? () => fetchFromSerpApi(baseTopic) : null,
      ];

  const primaryFn = primary ?? fallback;
  const fallbackFn = primary ? fallback : null;

  if (!primaryFn) throw new Error("No valid SERP API key available");

  try {
    const data = await primaryFn();
    return parseResults(data, baseTopic);
  } catch (primaryError) {
    if (fallbackFn) {
      const data = await fallbackFn();
      return parseResults(data, baseTopic);
    }
    throw primaryError;
  }
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}
