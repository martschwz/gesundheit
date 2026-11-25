// Supabase Edge Function: KI-Coach. Bekommt eine kurze Zusammenfassung der eigenen Daten
// und den bisherigen Gesprächsverlauf, antwortet auf Deutsch.
// Der Anthropic-API-Schlüssel liegt als Secret ANTHROPIC_API_KEY in Supabase. Nur angemeldete Nutzer.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `Du bist der persönliche Coach in einer Abnehm- und Gesundheits-App. Du kennst die Daten der Person (siehe unten) und hilfst ihr, gesund und dauerhaft abzunehmen.

So antwortest du:
- Auf Deutsch, per Du, freundlich, ehrlich und motivierend – nicht belehrend.
- Kurz und konkret: meist 3–8 Sätze oder eine kurze Liste. Beziehe dich auf die echten Zahlen aus den Daten.
- Bei Essensvorschlägen: alltagstaugliche, einfache Gerichte mit ungefähren kcal und Eiweiß, passend zum verbleibenden Tagesbudget. Gern auf die Lieblingsmahlzeiten zurückgreifen.
- Einfache Formatierung: **fett** für Wichtiges und Listen mit "- ". Keine Tabellen, keine Überschriften mit #.

Sicherheit:
- Keine Diagnosen und keine Ratschläge zu Medikamenten. Bei auffälligen Werten (z. B. Blutdruck, Blutzucker, Laborwerte) freundlich empfehlen, das ärztlich abklären zu lassen.
- Bei Warnzeichen wie Brustschmerz, Atemnot, starker Kopfschmerz, Lähmungen oder sehr hohem Blutdruck mit Beschwerden: sofort auf den Notruf 112 hinweisen.
- Nie weniger Kalorien empfehlen als die Untergrenze in den Daten, keine Crash-Diäten, kein längeres Fasten ohne ärztliche Begleitung, kein Abnehmen unter Normalgewicht.
- Wenn jemand von Essanfällen, starkem Kontrollverlust oder Schuldgefühlen beim Essen erzählt: einfühlsam reagieren und professionelle Hilfe (Hausarzt, Ernährungsberatung) vorschlagen.
- Erfinde keine Daten. Fehlt etwas, sag es und frag nach.`;

const WEEK = `Erstelle meinen Wochenrückblick für die letzten 7 Tage. Aufbau:
**Was gut lief** – 2–3 Punkte mit Zahlen.
**Was auffällt** – 1–3 Punkte (z. B. Lücken im Tagebuch, Eiweiß, Wasser, Schlaf, Gewichtstrend, Blutdruck).
**Für nächste Woche** – 2–3 kleine, konkrete Vorschläge.
Zum Schluss ein kurzer, ehrlicher Motivationssatz. Insgesamt höchstens 200 Wörter.`;

type Msg = { role: "user" | "assistant"; content: string };

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

  let body: { context?: string; messages?: Msg[]; mode?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const context = String(body.context ?? "").slice(0, 20000);
  let messages: Msg[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (body.mode === "week") messages = [{ role: "user", content: WEEK }];
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "bad_request" }, 400);

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      // Haiku: sehr günstig. Für ausführlichere Antworten hier "claude-sonnet-5-5" oder "claude-opus-5-5" eintragen.
      model: "claude-haiku-5-5",
      max_tokens: 16000,
      system: [
        { type: "text", text: SYSTEM },
        { type: "text", text: `Daten der Person (aus der App, aktueller Stand):\n${context}` },
      ],
      output_config: { effort: "medium" },
      messages,
    });
    if (response.stop_reason === "refusal") return json({ error: "refused" }, 422);
    const text = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    return json({ text });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "bad_api_key" }, 500);
    // Den Grund mitschicken (z. B. fehlendes Guthaben), damit die App ihn anzeigen kann
    if (e instanceof Anthropic.APIError) return json({ error: "api_error", status: e.status, detail: String(e.message).slice(0, 300) }, 502);
    console.error(e);
    return json({ error: "unknown", detail: String(e).slice(0, 300) }, 500);
  }
});
