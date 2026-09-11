// POST { unit:{name,description}, renter, departureAt, returnAt, findings:[{zone,title,severity,description}] } → { text }
import { corsHeaders, json, readJson } from "../_shared/http.ts";
import { callClaude } from "../_shared/anthropic.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const b = await readJson(req);
    const unit = (b.unit || {}) as { name?: string; description?: string };
    const findings = Array.isArray(b.findings) ? (b.findings as Array<{ zone: string; title: string; severity: string; description?: string }>).slice(0, 30) : [];
    const list = findings.length ? findings.map((f) => `- ${f.zone}: ${f.title} (${f.severity}). ${f.description || ""}`).join("\n") : "- none";
    const text = await callClaude([{ type: "text", text:
`Write a short, courteous notice from an RV rental company to a renter about damage found at return. Plain language, professional and calm, no legal threats. Structure: greeting, what was inspected and when, the new damage found (bulleted), what happens next (the owner will follow up with repair estimates and any applicable charges per the rental agreement), an invitation to reply with questions, and a sign-off from "Centex RV Rentals". Do not invent dollar amounts or policy details. Keep it under 220 words.

Unit: ${unit.name || "the trailer"}${unit.description ? ` (${unit.description})` : ""}
Renter: ${b.renter || "the renter"}
Departure photos taken: ${b.departureAt || "—"}
Return photos taken: ${b.returnAt || "—"}
Confirmed new damage:
${list}` }], 800);
    return json({ text });
  } catch (e) {
    return json({ error: (e as Error).message || "Draft failed" }, 500);
  }
});
