// Shared Anthropic call. Edge Functions can't import each other, so anything both
// functions need lives here and is imported from ../_shared/.
const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
export const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BASE64 = 8_000_000; // ~6 MB decoded; photos leave the phone at ~1280px

export type ImageIn = { media_type: string; data: string };

export function validateImage(img: unknown, label: string): ImageIn {
  const i = img as Partial<ImageIn> | undefined;
  if (!i || typeof i.data !== "string" || !i.data.length) throw new Error(`${label} image is missing`);
  if (!ALLOWED_MEDIA.has(String(i.media_type))) throw new Error(`${label} image must be JPEG, PNG or WebP`);
  if (i.data.length > MAX_IMAGE_BASE64) throw new Error(`${label} image is too large`);
  return { media_type: i.media_type as string, data: i.data };
}

export async function callClaude(content: unknown[], maxTokens = 1500): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set on the function");
  const model = Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}${t ? ": " + t.slice(0, 200) : ""}`);
  }
  const data = await res.json();
  return (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
}

export function parseJsonLoose(text: string): unknown {
  const clean = text.replace(/```json|```/gi, "").trim();
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("No JSON in response");
  return JSON.parse(clean.slice(a, b + 1));
}
