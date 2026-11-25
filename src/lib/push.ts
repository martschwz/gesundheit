// Benachrichtigungen (Web Push) für Erinnerungen.
import { supabase } from "./supabase";
import { ownerId } from "./store";
import type { ReminderItem } from "./types";

export const REMINDERS: { key: string; label: string; text: string; time: string; on: boolean }[] = [
  { key: "wiegen", label: "⚖️ Wiegen", text: "Morgens, wenn du dich noch nicht gewogen hast", time: "07:30", on: true },
  { key: "essen", label: "🍽️ Essen eintragen", text: "Abends, wenn heute weniger als 2 Mahlzeiten eingetragen sind", time: "20:00", on: true },
  { key: "trinken", label: "💧 Trinken", text: "Nachmittags, wenn du weniger als die Hälfte getrunken hast", time: "15:00", on: true },
  { key: "bp_morgen", label: "❤️ Blutdruck morgens", text: "Wenn heute noch nicht gemessen", time: "08:00", on: false },
  { key: "bp_abend", label: "❤️ Blutdruck abends", text: "Wenn heute abends noch nicht gemessen", time: "20:30", on: false },
  { key: "woche", label: "📊 Wochenrückblick", text: "Sonntags", time: "18:00", on: true },
];

export const defaultItems = (): ReminderItem[] => REMINDERS.map((r) => ({ key: r.key, enabled: r.on, time: r.time }));

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 5000)),
  ]);
  if (!reg) throw new Error("Benachrichtigungen gehen nur in der installierten App bzw. auf der veröffentlichten Seite.");
  return reg;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try { return await (await registration()).pushManager.getSubscription(); } catch { return null; }
}

function errorText(status?: number) {
  return status === 404 ? "Die Erinnerungen sind noch nicht eingerichtet (siehe Anleitung, Schritt „Erinnerungen“)." : "Das hat nicht geklappt. Bitte später nochmal versuchen.";
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error("Dieser Browser kann keine Benachrichtigungen. Öffne die App in Chrome.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Benachrichtigungen sind blockiert. Erlaube sie in den Einstellungen von Chrome für diese Seite.");
  const { data, error } = await supabase.functions.invoke("reminders", { body: { action: "publicKey" } });
  if (error || !data?.publicKey) throw new Error(errorText((error as { context?: { status?: number } })?.context?.status));
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.publicKey) as BufferSource });
  const { error: e2 } = await supabase.from("push_subscriptions").upsert({ endpoint: sub.endpoint, owner: ownerId(), subscription: sub.toJSON() });
  if (e2) throw new Error("Das Gerät konnte nicht gespeichert werden. Ist das Datenbank-Update 0003 ausgeführt?");
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function testPush(): Promise<number> {
  const { data, error } = await supabase.functions.invoke("reminders", { body: { action: "test" } });
  if (error) throw new Error(errorText((error as { context?: { status?: number } })?.context?.status));
  return Number(data?.sent ?? 0);
}
