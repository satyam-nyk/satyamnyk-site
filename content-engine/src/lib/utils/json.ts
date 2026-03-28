export function extractJson<T>(input: string): T {
  const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i);
  const raw = fencedMatch?.[1] ?? input;

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No valid JSON object found in model response");
  }

  const jsonString = raw.slice(start, end + 1);
  return JSON.parse(jsonString) as T;
}
