import { supabase } from "./supabase";
import { getState } from "./store";
import { coachContext } from "./coachContext";

export type ChatMsg = { role: "user" | "assistant"; content: string; at: string };

/** Gesprächsverlauf bleibt nur auf diesem Gerät. */
const KEY = () => `gesundheit:coach:${getState().session?.user.id ?? "anon"}`;
const WEEK_KEY = () => `gesundheit:wochenrueckblick:${getState().session?.user.id ?? "anon"}`;

export function loadChat(): ChatMsg[] {
  try { return JSON.parse(localStorage.getItem(KEY()) ?? "[]") as ChatMsg[]; } catch { return []; }
}
export function saveChat(list: ChatMsg[]) {
  try { localStorage.setItem(KEY(), JSON.stringify(list.slice(-40))); } catch { /* egal */ }
}
export function loadWeek(): { text: string; at: string } | null {
  try { return JSON.parse(localStorage.getItem(WEEK_KEY()) ?? "null"); } catch { return null; }
}
function saveWeek(w: { text: string; at: string }) {
  try { localStorage.setItem(WEEK_KEY(), JSON.stringify(w)); } catch { /* egal */ }
}

function context(): string {
  const d = getState().data;
  return coachContext({ settings: d.settings[0], weights: d.weights, meals: d.meals, daily: d.daily, measurements: d.measurements, labs: d.labs, favorites: [...d.favorites].sort((a, b) => b.uses - a.uses) });
}

async function call(body: Record<string, unknown>): Promise<string> {
  if (!navigator.onLine) throw new Error("Für den Coach braucht die App Internet.");
  const { data, error } = await supabase.functions.invoke("coach", { body: { ...body, context: context() } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const status = ctx?.status;
    let code = "";
    try { code = (await ctx?.clone().json())?.error ?? ""; } catch { /* egal */ }
    if (status === 404) throw new Error("Der Coach ist noch nicht eingerichtet (siehe Anleitung, Schritt „KI-Coach“).");
    if (code === "missing_api_key" || code === "bad_api_key") throw new Error("Der Coach braucht noch den Anthropic-Schlüssel in Supabase (Secret ANTHROPIC_API_KEY).");
    if (status === 429) throw new Error("Gerade sind zu viele Anfragen unterwegs. Bitte gleich nochmal versuchen.");
    throw new Error("Der Coach ist gerade nicht erreichbar. Bitte später nochmal versuchen.");
  }
  const text = String(data?.text ?? "").trim();
  if (!text) throw new Error("Der Coach hat keine Antwort geliefert. Bitte nochmal versuchen.");
  return text;
}

export async function ask(history: ChatMsg[]): Promise<string> {
  return call({ mode: "chat", messages: history.map(({ role, content }) => ({ role, content })) });
}

export async function weekReview(): Promise<{ text: string; at: string }> {
  const text = await call({ mode: "week" });
  const w = { text, at: new Date().toISOString() };
  saveWeek(w);
  return w;
}
