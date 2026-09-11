// AI comparison runs server-side (Supabase Edge Function) so the Anthropic key never
// ships in the app. The client only sends the two photos, the zone, and known damage.
import { getSupabase } from "../data/supabase.js";
import { blobToBase64 } from "../lib/images.js";
import { normalizeAiResult } from "../domain/findings.js";

export class AiUnavailable extends Error { constructor(m) { super(m); this.name = "AiUnavailable"; } }

function friendly(error) {
  const name = error && error.name; const msg = (error && error.message) || "";
  if (name === "FunctionsFetchError") return "Couldn't reach the comparison service. Check the connection and try again.";
  if (name === "FunctionsRelayError") return "The comparison service is misconfigured (relay error). Try again in a minute.";
  if (/401|jwt/i.test(msg)) return "Your sign-in expired. Sign in again in Settings.";
  return msg || "The comparison didn't come back.";
}
async function invoke(name, body) {
  const sb = getSupabase();
  if (!sb) throw new AiUnavailable("This build has no cloud configured, so AI comparison is off. Photos still save on the device.");
  const { data: sess } = await sb.auth.getSession();
  if (!sess || !sess.session) throw new AiUnavailable("Sign in under Settings to run AI comparisons.");
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) throw new Error(friendly(error));
  if (data && data.error) throw new Error(String(data.error));
  return data || {};
}

export async function compareZone({ zone, known, beforeBlob, afterBlob }) {
  const [before, after] = await Promise.all([blobToBase64(beforeBlob), blobToBase64(afterBlob)]);
  const data = await invoke("compare-zone", {
    zone: { id: zone.id, name: zone.name, tip: zone.tip || "" },
    known: known.map((k) => ({ code: k.code, title: k.title, locationText: k.locationText || "", severity: k.severity, status: k.status })),
    before, after,
  });
  return normalizeAiResult(data.result, zone.id);
}

export async function draftRenterNotice(payload) {
  const data = await invoke("draft-notice", payload);
  return String(data.text || "").trim();
}
