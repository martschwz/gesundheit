import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { achievements, streak } from "../lib/achievements";
import { ask, loadChat, loadWeek, saveChat, weekReview, type ChatMsg } from "../lib/coach";
import { dayKey, diffDays, formatDay } from "../lib/date";
import type { Settings } from "../lib/types";
import { Markdown } from "../components/Markdown";
import { Confirm } from "../components/ui";

const QUICK = [
  "Was passt heute Abend noch?",
  "Ideen für eiweißreiche Snacks",
  "Wie läuft es mit meinem Gewicht?",
  "Was kann ich morgen besser machen?",
];

export function Coach({ settings }: { settings: Settings }) {
  return (
    <div className="grid narrow">
      <Streaks />
      <Week />
      <Chat />
      <Achievements settings={settings} />
    </div>
  );
}

function Streaks() {
  const meals = useStore((s) => s.data.meals);
  const weights = useStore((s) => s.data.weights);
  const food = streak(meals.map((m) => m.day));
  const scale = streak(weights.map((w) => w.day));
  const today = dayKey();
  const loggedToday = meals.some((m) => m.day === today);
  return (
    <section className="streaks">
      <div className="streak"><span className="big">🔥 {food.current}</span><span>{food.current === 1 ? "Tag" : "Tage"} Essen eingetragen{!loggedToday && food.current > 0 ? " – heute noch eintragen!" : ""}</span><span className="muted small">Rekord: {food.best}</span></div>
      <div className="streak"><span className="big">⚖️ {scale.current}</span><span>{scale.current === 1 ? "Tag" : "Tage"} gewogen</span><span className="muted small">Rekord: {scale.best}</span></div>
    </section>
  );
}

function Week() {
  const [week, setWeek] = useState(loadWeek);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fresh = week && diffDays(week.at.slice(0, 10), dayKey()) < 1;
  async function run() {
    setBusy(true); setErr(null);
    try { setWeek(await weekReview()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <section className="card grid">
      <div className="row"><h2>📊 Wochenrückblick</h2><span className="spacer" />
        <button className={`btn sm ${fresh ? "" : "primary"}`} onClick={run} disabled={busy}>{busy ? "Wird erstellt …" : week ? "Neu erstellen" : "Woche auswerten"}</button>
      </div>
      {week ? <>
        <span className="small muted">Erstellt {formatDay(week.at.slice(0, 10))}, {new Date(week.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</span>
        <Markdown text={week.text} />
      </> : <p className="muted" style={{ margin: 0 }}>Der Coach schaut sich deine letzten 7 Tage an: was gut lief, was auffällt und was du nächste Woche ausprobieren kannst.</p>}
      {err && <div className="notice err" role="alert">{err}</div>}
    </section>
  );
}

function Chat() {
  const [list, setList] = useState<ChatMsg[]>(loadChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (list.length) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [list.length, busy]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: ChatMsg[] = [...list, { role: "user", content: question, at: new Date().toISOString() }];
    setList(next); saveChat(next); setText(""); setBusy(true); setErr(null);
    try {
      const answer = await ask(next);
      const done: ChatMsg[] = [...next, { role: "assistant", content: answer, at: new Date().toISOString() }];
      setList(done); saveChat(done);
    } catch (e) {
      setErr((e as Error).message);
      // Frage wieder ins Eingabefeld, damit nichts verloren geht
      setList(list); saveChat(list); setText(question);
    } finally { setBusy(false); }
  }

  return (
    <section className="card grid">
      <div className="row"><h2>💬 Frag deinen Coach</h2><span className="spacer" />
        {list.length > 0 && <Confirm label="Neu beginnen" confirmLabel="Ja, löschen" onConfirm={() => { setList([]); saveChat([]); }} />}
      </div>
      {list.length > 0 && (
        <div className="chat">
          {list.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>{m.role === "assistant" ? <Markdown text={m.content} /> : m.content}</div>
          ))}
          {busy && <div className="bubble assistant typing" aria-label="Coach schreibt">…</div>}
          <div ref={end} />
        </div>
      )}
      <div className="chips">
        {QUICK.map((q) => <button key={q} className="chipbtn" onClick={() => send(q)} disabled={busy}>{q}</button>)}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Deine Frage …" aria-label="Frage an den Coach" style={{ flex: 1, minWidth: 0 }} />
        <button className="btn primary" disabled={busy || !text.trim()}>Senden</button>
      </form>
      {err && <div className="notice err" role="alert">{err}</div>}
      <p className="small muted" style={{ margin: 0 }}>Für die Antwort schickt die App eine Zusammenfassung deiner Werte der letzten 2 Wochen an Claude (Anthropic). Der Coach gibt allgemeine Tipps und ersetzt keine ärztliche Beratung.</p>
    </section>
  );
}

function Achievements({ settings }: { settings: Settings }) {
  const d = useStore((s) => s.data);
  const list = achievements({ settings, weights: d.weights, meals: d.meals, daily: d.daily, measurements: d.measurements, labs: d.labs });
  const done = list.filter((a) => a.done);
  return (
    <section className="card grid">
      <div className="row"><h2>🏆 Erfolge</h2><span className="spacer" /><span className="muted small"><b className="ink">{done.length}</b> von {list.length}</span></div>
      <div className="achs">
        {[...done, ...list.filter((a) => !a.done)].map((a) => (
          <div key={a.id} className={`ach ${a.done ? "done" : ""}`}>
            <span className="icon">{a.icon}</span>
            <b>{a.title}</b>
            <span className="small muted">{a.text}</span>
            {!a.done && a.progress && <div className="goal"><i style={{ width: `${(a.progress[0] / a.progress[1]) * 100}%` }} /></div>}
          </div>
        ))}
      </div>
    </section>
  );
}
