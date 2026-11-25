// Supabase Edge Function: Erinnerungen als Handy-Benachrichtigung (Web Push).
// - "publicKey": öffentlicher Schlüssel für die Anmeldung des Geräts (wird beim ersten Mal erzeugt)
// - "test": Probe-Benachrichtigung an die eigenen Geräte
// - "tick": wird alle 15 Minuten von der Datenbank (pg_cron) aufgerufen und verschickt fällige Erinnerungen
// Beim Einrichten "Verify JWT" ausschalten – die Funktion prüft Anmeldung bzw. Zugangscode selbst.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const APP_URL = "https://martschwz.github.io/gesundheit/";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Item = { key: string; enabled: boolean; time: string };
// deno-lint-ignore no-explicit-any
type Sub = { endpoint: string; subscription: any };

async function vapid() {
  const { data } = await admin.from("push_config").select("*").eq("id", 1).single();
  let pub = data?.public_key as string | null, priv = data?.private_key as string | null;
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    pub = k.publicKey; priv = k.privateKey;
    await admin.from("push_config").update({ public_key: pub, private_key: priv }).eq("id", 1);
  }
  webpush.setVapidDetails(APP_URL, pub, priv);
  return { pub, token: data?.cron_token as string };
}

async function sendTo(owner: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, subscription").eq("owner", owner);
  let sent = 0;
  for (const s of (subs ?? []) as Sub[]) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({ url: APP_URL, ...payload }), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }
  return sent;
}

/** Datum, Minuten seit Mitternacht und Wochentag in der Zeitzone der Person. */
function local(tz: string, d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute), weekday: p.weekday };
}

const fmtL = (ml: number) => (ml / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Prüft, ob die Erinnerung nötig ist, und liefert den Text – oder null. */
async function message(owner: string, key: string, day: string, weekday: string): Promise<{ title: string; body: string } | null> {
  // deno-lint-ignore no-explicit-any
  const count = async (table: string, filter: (q: any) => any) => {
    const { count } = await filter(admin.from(table).select("*", { count: "exact", head: true }).eq("owner", owner));
    return count ?? 0;
  };
  switch (key) {
    case "wiegen":
      return (await count("weights", (q) => q.eq("day", day))) ? null : { title: "⚖️ Zeit zum Wiegen", body: "Kurz auf die Waage – am besten vor dem Frühstück." };
    case "essen":
      return (await count("meals", (q) => q.eq("day", day))) >= 2 ? null : { title: "🍽️ Schon alles eingetragen?", body: "Ein Foto pro Mahlzeit genügt – dann stimmt deine Bilanz." };
    case "trinken": {
      const { data: d } = await admin.from("daily").select("water_ml").eq("owner", owner).eq("day", day).maybeSingle();
      const { data: w } = await admin.from("weights").select("kg").eq("owner", owner).order("day", { ascending: false }).limit(1).maybeSingle();
      const goal = Math.min(3000, Math.max(1500, Math.round(((w?.kg ?? 70) * 35) / 250) * 250));
      const ml = d?.water_ml ?? 0;
      return ml >= goal / 2 ? null : { title: "💧 Trinken nicht vergessen", body: `Bisher ${fmtL(ml)} von ${fmtL(goal)} Litern. Zeit für ein Glas Wasser!` };
    }
    case "bp_morgen":
      return (await count("measurements", (q) => q.eq("kind", "bp").eq("day", day))) ? null : { title: "❤️ Blutdruck messen", body: "5 Minuten ruhig sitzen, dann messen und eintragen." };
    case "bp_abend":
      return (await count("measurements", (q) => q.eq("kind", "bp").eq("day", day).gte("time", "15:00"))) ? null : { title: "❤️ Abendmessung", body: "Zeit für deine Blutdruck-Messung am Abend." };
    case "woche":
      return weekday === "Sun" ? { title: "📊 Dein Wochenrückblick", body: "Schau dir an, wie deine Woche gelaufen ist – der Coach wertet sie für dich aus." } : null;
    default:
      return null;
  }
}

async function tick() {
  const { data: rows } = await admin.from("reminder_settings").select("owner, items, tz");
  let sent = 0;
  for (const r of rows ?? []) {
    const now = local(r.tz || "Europe/Berlin");
    for (const it of (r.items ?? []) as Item[]) {
      if (!it.enabled || !/^\d{1,2}:\d{2}$/.test(it.time)) continue;
      const [h, m] = it.time.split(":").map(Number);
      const due = h * 60 + m;
      if (now.minutes < due || now.minutes >= due + 30) continue;
      // Pro Tag nur einmal – der Eintrag verhindert auch doppelte Nachrichten bei überlappenden Aufrufen
      const { error } = await admin.from("reminder_log").insert({ owner: r.owner, key: it.key, day: now.day });
      if (error) continue;
      const msg = await message(r.owner, it.key, now.day, now.weekday);
      if (msg) sent += await sendTo(r.owner, { ...msg, tag: it.key });
    }
  }
  // Alte Einträge aufräumen
  const cut = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  await admin.from("reminder_log").delete().lt("day", cut);
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: { action?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  try {
    const { pub, token } = await vapid();
    if (body.action === "tick") {
      if (!body.token || body.token !== token) return json({ error: "forbidden" }, 403);
      return json({ sent: await tick() });
    }
    // Alle anderen Aktionen nur für angemeldete Nutzer
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: user } = await sb.auth.getUser();
    if (!user?.user) return json({ error: "not_signed_in" }, 401);
    if (body.action === "publicKey") return json({ publicKey: pub });
    if (body.action === "test") {
      const sent = await sendTo(user.user.id, { title: "🔔 Es klappt!", body: "So sehen deine Erinnerungen aus.", tag: "test" });
      return json({ sent });
    }
    return json({ error: "bad_request" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "unknown" }, 500);
  }
});
