import slugify from "slugify";

export function makeSlug(value: string) {
  return slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export function estimateReadingTime(html: string) {
  const stripped = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = stripped ? stripped.split(" ").length : 0;
  return Math.max(1, Math.ceil(wordCount / 220));
}
