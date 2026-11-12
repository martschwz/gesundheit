// Supabase Edge Function: schätzt Kalorien und Nährwerte einer Mahlzeit
// aus einem Foto und/oder einer Beschreibung.
// Der Anthropic-API-Schlüssel liegt als Secret ANTHROPIC_API_KEY in Supabase
// und gelangt nie in die App selbst. Nur angemeldete Nutzer dürfen die Funktion aufrufen.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "string" },
          kcal: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
        required: ["name", "amount", "kcal", "protein", "carbs", "fat"],
        additionalProperties: false,
      },
    },
    hint: { type: "string" },
  },
  required: ["title", "items", "hint"],
  additionalProperties: false,
};

const SYSTEM = `Du hilfst bei einem Ernährungstagebuch zum Abnehmen. Du schätzt die Nährwerte einer Mahlzeit so realistisch wie möglich.
- Zerlege die Mahlzeit in ihre Bestandteile (z. B. "Spaghetti", "Bolognese-Soße", "Parmesan"). Getränke nur, wenn sie zu sehen oder genannt sind.
- name: kurzer deutscher Name. amount: geschätzte Menge mit Einheit, z. B. "180 g", "2 Scheiben", "300 ml".
- kcal, protein, carbs, fat: Werte für genau diese Menge; Nährstoffe in Gramm, alles als ganze Zahlen.
- Schätze Portionsgrößen anhand von Teller, Besteck und Verpackungen. Denke an versteckte Fette wie Bratöl, Butter, Dressing und Soßen.
- Wenn eine Beschreibung oder Notiz mitgeschickt wird, hat sie Vorrang vor dem, was du auf dem Foto vermutest.
- title: kurzer Name der ganzen Mahlzeit, z. B. "Spaghetti Bolognese".
- hint: höchstens ein kurzer Satz auf Deutsch, was unsicher ist und leicht nachzuprüfen wäre (z. B. "Ölmenge geschätzt – bei viel Öl eher +100 kcal."). Leer, wenn nichts Wichtiges unsicher ist.
- Ist kein Essen oder Getränk zu erkennen, gib eine leere Liste zurück und erkläre das in hint.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: user } = await sb.auth.getUser();
  if (!user?.user) return json({ error: "not_signed_in" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "missing_api_key" }, 500);

  let body: { image?: string; mediaType?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const { image, mediaType = "image/jpeg" } = body;
  const text = (body.text ?? "").slice(0, 2000).trim();
  if (!image && !text) return json({ error: "bad_request" }, 400);
  if (image && image.length > 8_000_000) return json({ error: "bad_image" }, 400);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: image } });
  content.push({
    type: "text",
    text: image
      ? text ? `Foto meiner Mahlzeit. Meine Notiz dazu: ${text}` : "Foto meiner Mahlzeit."
      : `Das habe ich gegessen: ${text}`,
  });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      // Haiku: sehr günstig (unter 0,1 Cent pro Foto) und für Nährwert-Schätzungen ausreichend.
      // Für genauere Schätzungen hier "claude-sonnet-5-5" oder "claude-opus-5-5" eintragen.
      model: "claude-haiku-5-5",
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return json({ error: "refused" }, 422);
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return json({ title: "", items: [], hint: "" });
    return json(JSON.parse(block.text));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "bad_api_key" }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: "api_error", status: e.status }, 502);
    return json({ error: "unknown" }, 500);
  }
});
