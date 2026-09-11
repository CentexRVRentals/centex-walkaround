// POST { zone:{id,name,tip}, known:[{code,title,locationText,severity,status}], before:{media_type,data}, after:{media_type,data} }
// → { result: { alignment:{score,note}, findings:[...], summary } }
import { corsHeaders, json, readJson } from "../_shared/http.ts";
import { callClaude, parseJsonLoose, validateImage } from "../_shared/anthropic.ts";

type Known = { code?: string; title?: string; locationText?: string; severity?: string; status?: string };

function prompt(zone: { name: string; tip: string }, known: Known[]): string {
  const knownText = known.length
    ? known.map((k) => `- ${k.code}: ${k.title} — ${k.locationText || "location not noted"} (${k.severity}, ${k.status})`).join("\n")
    : "- none recorded for this zone";
  return `You are a meticulous damage inspector for an RV travel-trailer rental fleet. Image 1 is the DEPARTURE photo taken before the rental. Image 2 is the RETURN photo of the same zone taken after the rental.
Zone: ${zone.name}. Framing guide staff were given: ${zone.tip}
Damage already in the registry for this zone:
${knownText}

Do the following:
1. Rate alignment between the two photos (same angle, distance, framing) from 0 to 100 and say in one sentence whether a retake would help.
2. Find differences that indicate physical damage new since departure: scratches, scuffs, dents, cracks, punctures, tears, missing or broken parts, stains, water marks, bent or loose components.
3. Ignore differences caused by lighting, shadows, reflections, weather, dust, light dirt, background, people, objects on the ground, awning or door position, or camera angle. Do not report those as findings.
4. If a finding matches a registry item, set type to "matches_known" and give its code. If you cannot tell whether a difference is damage, set type to "uncertain". Be conservative: a fleet owner will review every finding.

Respond with ONLY this JSON and no markdown:
{"alignment":{"score":0,"note":""},"findings":[{"title":"","description":"","location_text":"","x":0,"y":0,"severity":"minor|moderate|major","confidence":0.0,"type":"new|matches_known|uncertain","known_code":null}],"summary":""}
x and y are the percent position (0-100) of the finding's center within Image 2. Use an empty findings array when nothing changed.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await readJson(req);
    const zone = (body.zone || {}) as { id?: string; name?: string; tip?: string };
    if (!zone.name) return json({ error: "zone.name is required" }, 400);
    const known = Array.isArray(body.known) ? (body.known as Known[]).slice(0, 40) : [];
    const before = validateImage(body.before, "Departure");
    const after = validateImage(body.after, "Return");
    const text = await callClaude([
      { type: "text", text: "Image 1 — DEPARTURE:" }, { type: "image", source: { type: "base64", ...before } },
      { type: "text", text: "Image 2 — RETURN:" }, { type: "image", source: { type: "base64", ...after } },
      { type: "text", text: prompt({ name: String(zone.name), tip: String(zone.tip || "") }, known) },
    ]);
    let result: unknown;
    try { result = parseJsonLoose(text); } catch { return json({ error: "The model's answer wasn't valid JSON this time. Try again." }, 502); }
    return json({ result });
  } catch (e) {
    return json({ error: (e as Error).message || "Comparison failed" }, 500);
  }
});
