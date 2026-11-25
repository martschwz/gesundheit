import { useEffect, useState } from "react";
import { ownerId, upsert, useStore } from "../lib/store";
import { REMINDERS, currentSubscription, defaultItems, disablePush, enablePush, pushSupported, testPush } from "../lib/push";
import type { ReminderItem } from "../lib/types";
import { toast } from "../components/ui";

export function Reminders() {
  const missing = useStore((s) => s.missing.includes("reminder_settings"));
  const row = useStore((s) => s.data.reminder_settings[0]);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { currentSubscription().then((s) => setOn(!!s)); }, []);

  if (missing) return (
    <section className="card grid">
      <h2>🔔 Erinnerungen</h2>
      <p className="small" style={{ margin: 0 }}>Dafür braucht die Datenbank noch ein Update: Inhalt von <code>supabase/migrations/0003_coach.sql</code> im SQL Editor von Supabase ausführen.</p>
    </section>
  );

  const items: ReminderItem[] = REMINDERS.map((r) => row?.items.find((i) => i.key === r.key) ?? { key: r.key, enabled: r.on, time: r.time });
  const save = (next: ReminderItem[]) => upsert("reminder_settings", [{ owner: ownerId(), items: next, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin" }]);
  const change = (key: string, patch: Partial<ReminderItem>) => save(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function toggle() {
    setBusy(true); setErr(null);
    try {
      if (on) { await disablePush(); setOn(false); toast("Benachrichtigungen aus"); }
      else {
        await enablePush();
        if (!row) save(defaultItems());
        setOn(true);
        toast("Benachrichtigungen an");
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setErr(null);
    try {
      const n = await testPush();
      toast(n ? "Probe-Nachricht ist unterwegs" : "Kein Gerät gefunden – bitte Benachrichtigungen neu einschalten");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="card grid">
      <h2>🔔 Erinnerungen</h2>
      {!pushSupported() ? <p className="small muted" style={{ margin: 0 }}>Dieser Browser kann keine Benachrichtigungen. Öffne die App in Chrome und lege sie auf den Startbildschirm.</p> : (
        <div className="row">
          <button className={`btn ${on ? "" : "primary"}`} onClick={toggle} disabled={busy || on === null}>{on ? "Auf diesem Handy ausschalten" : "Auf diesem Handy einschalten"}</button>
          {on && <button className="btn ghost" onClick={test} disabled={busy}>Probe-Nachricht</button>}
        </div>
      )}
      {err && <div className="notice err" role="alert">{err}</div>}
      <div className="grid" style={{ gap: 4 }}>
        {REMINDERS.map((r) => {
          const it = items.find((i) => i.key === r.key)!;
          return (
            <div key={r.key} className="remrow">
              <label className="check"><input type="checkbox" checked={it.enabled} onChange={(e) => change(r.key, { enabled: e.target.checked })} /> {r.label}</label>
              <input type="time" value={it.time} onChange={(e) => e.target.value && change(r.key, { time: e.target.value })} disabled={!it.enabled} aria-label={`Uhrzeit ${r.label}`} />
              <span className="small muted">{r.text}</span>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Die Erinnerung kommt nur, wenn sie nötig ist – hast du dich z. B. schon gewogen, bleibt das Handy still. Tipp für Xiaomi: In den Handy-Einstellungen bei Chrome „Autostart“ erlauben und den Energiesparmodus auf „Keine Einschränkungen“ stellen, sonst kommen Nachrichten manchmal verspätet.</p>
    </section>
  );
}
