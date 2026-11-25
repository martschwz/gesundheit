// Verständliche Fehlermeldungen für die Server-Funktionen (Foto-Schätzung, Coach).
type FnErr = { name?: string; message?: string; context?: Response };

export async function functionError(error: unknown, what: string, setupStep: string): Promise<Error> {
  const e = error as FnErr;
  const res = e?.context instanceof Response ? e.context : undefined;
  const status = res?.status;
  let body: { error?: string; status?: number; detail?: string } = {};
  try { body = (await res?.clone().json()) ?? {}; } catch { /* keine JSON-Antwort */ }
  const detail = (body.detail ?? "").toLowerCase();

  if (!res) return new Error(`${what} ist gerade nicht erreichbar. Prüfe die Internetverbindung. (Technisch: ${e?.name ?? "Netzwerk"})`);
  if (status === 404) return new Error(`${what} ist noch nicht eingerichtet: In Supabase fehlt die Edge Function (siehe Anleitung, Schritt „${setupStep}“).`);
  if (body.error === "missing_api_key") return new Error("In Supabase fehlt noch der Anthropic-Schlüssel: Edge Functions → Secrets → Name ANTHROPIC_API_KEY.");
  if (body.error === "bad_api_key") return new Error("Der Anthropic-Schlüssel wird nicht akzeptiert. Prüfe das Secret ANTHROPIC_API_KEY in Supabase (vollständig kopiert, ohne Leerzeichen?).");
  if (detail.includes("credit") || detail.includes("billing")) return new Error("Beim Anthropic-Konto ist noch kein Guthaben vorhanden. Auf platform.claude.com unter Billing Guthaben aufladen.");
  if (status === 429 || body.error === "rate_limited") return new Error("Gerade sind zu viele Anfragen unterwegs. Bitte gleich nochmal versuchen.");
  if (status === 401) return new Error("Du bist nicht mehr angemeldet. Bitte unter „Ich“ ab- und wieder anmelden.");
  if (body.error === "refused") return new Error("Dazu kann die KI leider nichts sagen. Bitte anders formulieren.");
  if (body.error === "bad_image") return new Error("Das Foto ist zu groß. Bitte ein anderes Foto versuchen.");
  const code = [status, body.error, body.status, body.detail].filter(Boolean).join(" · ");
  return new Error(`${what} hat nicht geklappt. (Technisch: ${code || "unbekannt"}) – schick Claude diese Meldung, dann finden wir den Fehler.`);
}
