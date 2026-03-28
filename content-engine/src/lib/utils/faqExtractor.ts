/**
 * Extract FAQ items from article content
 * Parses the FAQ section from HTML and returns structured Q&A pairs
 */
export function extractFAQsFromContent(htmlContent: string) {
  const faqSectionRegex = /<section class="faq-section">([\s\S]*?)<\/section>/i;
  const match = htmlContent.match(faqSectionRegex);

  if (!match) {
    return [];
  }

  const faqContent = match[1];
  const faqs = [];

  // Find all Q&A pairs: <h3>Question</h3> followed by <p>Answer</p>
  const qaPairs = faqContent.match(/<h3[^>]*>(.*?)<\/h3>\s*<p[^>]*>(.*?)<\/p>/gi) || [];

  for (const pair of qaPairs) {
    const question = pair.match(/<h3[^>]*>(.*?)<\/h3>/i)?.[1] || '';
    const answer = pair.match(/<p[^>]*>(.*?)<\/p>/i)?.[1] || '';

    if (question && answer) {
      faqs.push({
        question: stripHtml(question),
        answer: stripHtml(answer),
      });
    }
  }

  return faqs;
}

/**
 * Remove FAQ section from article content HTML
 * Used to prevent FAQ from rendering with the main article prose
 */
export function removeFAQSectionFromContent(htmlContent: string): string {
  return htmlContent.replace(/<section class="faq-section">[\s\S]*?<\/section>/i, '');
}

/**
 * Remove LD+JSON schema script from HTML content
 * Useful if we want to manage it separately
 */
export function removeLdJsonFromContent(htmlContent: string): string {
  return htmlContent.replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/i, '');
}

/**
 * Extract LD+JSON schema from content
 */
export function extractLdJsonFromContent(htmlContent: string): object | null {
  const match = htmlContent.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Simple HTML tag stripper
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
