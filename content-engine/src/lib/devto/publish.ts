import axios from "axios";
import TurndownService from "turndown";

type PublishToDevtoInput = {
  title: string;
  htmlContent: string;
  tags: string[];
  canonicalUrl: string;
  published?: boolean;
};

const DEVTO_API_KEY = (process.env.DEVTO_API_KEY ?? "").trim();

const turndown = new TurndownService({ headingStyle: "atx" });

export async function publishToDevto(input: PublishToDevtoInput) {
  if (!DEVTO_API_KEY) {
    throw new Error("DEVTO_API_KEY is not set");
  }

  const markdownBody = turndown.turndown(input.htmlContent);

  const { data } = await axios.post(
    "https://dev.to/api/articles",
    {
      article: {
        title: input.title,
        body_markdown: markdownBody,
        tags: input.tags.slice(0, 4),
        published: Boolean(input.published),
        canonical_url: input.canonicalUrl,
      },
    },
    {
      headers: {
        "api-key": DEVTO_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );

  return data;
}
