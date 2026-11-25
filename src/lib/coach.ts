import { supabase } from "./supabase";
import { getState } from "./store";
import { coachContext } from "./coachContext";
import { functionError } from "./fnError";

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
  if (error) throw await functionError(error, "Der Coach", "KI-Coach");
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
