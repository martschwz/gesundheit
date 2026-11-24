import { useState } from "react";
import { newId, ownerId, remove, upsert, useStore } from "../lib/store";
import { fmt, parseNum } from "../lib/calc";
import { addDays, dayKey, diffDays, formatDate, formatDay } from "../lib/date";
import {
  BODY_KINDS, GLUCOSE_TAGS, LABS, STEPS_GOAL, formatDuration, glucoseTagLabel, labDef, parseDuration,
  rateBP, rateGlucose, ratePulse, rateSleep, rateWaist, waterGoal,
} from "../lib/health";
import { currentKg, weightPoints } from "../lib/selectors";
import type { Daily, Lab, MeasureKind, Measurement, Settings } from "../lib/types";
import { BarChart, LineChart, Pill } from "../components/Charts";
import { Confirm, Seg, toast } from "../components/ui";

type Tab = "alltag" | "bp" | "bz" | "mass" | "labor";
const TAB_KEY = "gesundheit:werte-tab";

const num = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const pad = (n: number) => String(n).padStart(2, "0");
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const timeFrac = (t: string) => { const [h, m] = t.split(":").map(Number); return ((h || 0) * 60 + (m || 0)) / 1440; };
const sortDesc = (a: { day: string; time?: string }, b: { day: string; time?: string }) => b.day.localeCompare(a.day) || (b.time ?? "").localeCompare(a.time ?? "");

export function Values({ settings }: { settings: Settings }) {
  const outdated = useStore((s) => s.schemaOutdated);
  const [tab, setTabState] = useState<Tab>(() => {
    try { return (localStorage.getItem(TAB_KEY) as Tab) || "alltag"; } catch { return "alltag"; }
  });
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* egal */ } };

  if (outdated) return (
    <div className="card grid narrow">
      <h2>Noch ein Datenbank-Update nötig</h2>
      <p style={{ margin: 0 }}>Für die Gesundheitswerte braucht die Datenbank neue Tabellen. Öffne in Supabase den <b>SQL Editor</b>, füge den Inhalt der Datei <code>supabase/migrations/0002_werte.sql</code> ein und klicke auf <b>Run</b>. Danach die App neu laden.</p>
    </div>
  );

  return (
    <div className="grid narrow">
      <Seg value={tab} onChange={setTab} label="Bereich" options={[["alltag", "Alltag"], ["bp", "Blutdruck"], ["bz", "Blutzucker"], ["mass", "Maße"], ["labor", "Labor"]]} />
      {tab === "alltag" && <Everyday settings={settings} />}
      {tab === "bp" && <Pressure />}
      {tab === "bz" && <Sugar />}
      {tab === "mass" && <Body settings={settings} />}
      {tab === "labor" && <Labs settings={settings} />}
      <p className="small muted center">Die Ampel ist eine grobe Orientierung und ersetzt keine ärztliche Beratung.</p>
    </div>
  );
}

/* ---------- Gemeinsame Bausteine ---------- */

function DayTime({ day, setDay, time, setTime }: { day: string; setDay: (d: string) => void; time?: string; setTime?: (t: string) => void }) {
  return (
    <div className="row">
      <input type="date" value={day} max={dayKey()} onChange={(e) => setDay(e.target.value || dayKey())} aria-label="Datum" style={{ width: "auto" }} />
      {setTime && <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Uhrzeit" style={{ width: "auto" }} />}
    </div>
  );
}

function useMeasurements(kind: MeasureKind) {
  const all = useStore((s) => s.data.measurements);
  return all.filter((m) => m.kind === kind).sort(sortDesc);
}

function saveMeasurement(m: Omit<Measurement, "id" | "owner" | "created_at" | "note" | "tag" | "v2" | "v3"> & Partial<Measurement>) {
  upsert("measurements", [{ id: newId(), owner: ownerId(), note: "", tag: "", v2: null, v3: null, created_at: new Date().toISOString(), ...m }]);
}

function MoreList<T>({ items, render }: { items: T[]; render: (t: T) => React.ReactNode }) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  return (
    <section className="card grid" style={{ gap: 4 }}>
      <h3>Einträge</h3>
      {(all ? items : items.slice(0, 8)).map(render)}
      {!all && items.length > 8 && <button className="btn sm ghost" onClick={() => setAll(true)}>Alle {items.length} anzeigen</button>}
    </section>
  );
}

function updateDaily(rows: Daily[], day: string, patch: Partial<Daily>) {
  const old = rows.find((r) => r.day === day);
  upsert("daily", [{ owner: ownerId(), day, water_ml: 0, steps: null, sleep_hours: null, sleep_quality: null, ...old, ...patch }]);
}

/* ---------- Alltag: Wasser, Schritte, Schlaf ---------- */

const SLEEP_FACES = ["😫", "😕", "😐", "🙂", "😃"];

export function WaterCard({ day, settings, compact }: { day: string; settings: Settings; compact?: boolean }) {
  const daily = useStore((s) => s.data.daily);
  const weights = useStore((s) => s.data.weights);
  const goal = waterGoal(currentKg(weightPoints(weights), settings));
  const ml = daily.find((d) => d.day === day)?.water_ml ?? 0;
  const add = (n: number) => updateDaily(daily, day, { water_ml: Math.max(0, ml + n) });
  return (
    <section className="card grid" style={{ gap: 8 }}>
      <div className="row"><b>💧 Wasser</b><span className="spacer" /><span className="small muted"><b className="ink">{fmt(ml / 1000, 2)}</b> von {fmt(goal / 1000, 1)} l</span></div>
      <div className="goal"><i className="water" style={{ width: `${Math.min(100, (ml / goal) * 100)}%` }} /></div>
      <div className="row">
        <button className="btn sm" onClick={() => add(250)}>+ Glas</button>
        <button className="btn sm" onClick={() => add(500)}>+ Flasche</button>
        {!compact && <button className="btn sm" onClick={() => add(1000)}>+ 1 l</button>}
        <span className="spacer" />
        <button className="btn sm ghost" onClick={() => add(-250)} disabled={!ml} aria-label="Ein Glas abziehen">− Glas</button>
      </div>
    </section>
  );
}

function Everyday({ settings }: { settings: Settings }) {
  const daily = useStore((s) => s.data.daily);
  const today = dayKey();
  const [day, setDay] = useState(today);
  const row = daily.find((d) => d.day === day);
  const [steps, setSteps] = useState("");
  const [sleep, setSleep] = useState("");

  function saveSteps(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNum(steps.replace(/\./g, ""));
    if (n === null || n < 0 || n > 150000) return toast("Bitte die Schritte als Zahl eingeben");
    updateDaily(daily, day, { steps: Math.round(n) });
    setSteps("");
    toast("Gespeichert");
  }
  function saveSleep(e: React.FormEvent) {
    e.preventDefault();
    const h = parseDuration(sleep);
    if (h === null || h > 16) return toast("Bitte die Schlafdauer eingeben, z. B. 7:30");
    updateDaily(daily, day, { sleep_hours: Math.round(h * 100) / 100 });
    setSleep("");
    toast("Gespeichert");
  }

  const last = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const sleepPts = daily.filter((d) => d.sleep_hours !== null && diffDays(d.day, today) <= 60).map((d) => ({ day: d.day, v: d.sleep_hours! }));
  const stepVals = last.map((d) => byDay.get(d)?.steps ?? null);
  const withSteps = stepVals.filter((v): v is number => v !== null);

  return (
    <>
      <div className="daynav">
        <button className="btn sm" onClick={() => setDay(addDays(day, -1))} aria-label="Tag zurück">‹</button>
        <h2>{formatDay(day, today)}</h2>
        <button className="btn sm" onClick={() => setDay(addDays(day, 1))} disabled={day >= today} aria-label="Tag vor">›</button>
      </div>

      <WaterCard day={day} settings={settings} />

      <form className="card grid" style={{ gap: 8 }} onSubmit={saveSteps}>
        <div className="row"><b>👟 Schritte</b><span className="spacer" />
          {row?.steps != null && <span className="small muted"><b className="ink">{fmt(row.steps)}</b> von {fmt(STEPS_GOAL)}</span>}
        </div>
        {row?.steps != null && <div className="goal"><i style={{ width: `${Math.min(100, (row.steps / STEPS_GOAL) * 100)}%` }} /></div>}
        <div className="row">
          <input type="text" inputMode="numeric" placeholder="z. B. 8500" value={steps} onChange={(e) => setSteps(e.target.value)} style={{ width: 140 }} aria-label="Schritte" />
          <button className="btn">{row?.steps != null ? "Ändern" : "Speichern"}</button>
        </div>
        <span className="small muted">Den Wert findest du in Huawei Health auf der Startseite.</span>
      </form>

      <form className="card grid" style={{ gap: 8 }} onSubmit={saveSleep}>
        <div className="row"><b>😴 Schlaf</b><span className="spacer" />
          {row?.sleep_hours != null && <><b>{formatDuration(row.sleep_hours)}</b><Pill level={rateSleep(row.sleep_hours).level}>{rateSleep(row.sleep_hours).label}</Pill></>}
        </div>
        <div className="row">
          <input type="text" placeholder="z. B. 7:30" value={sleep} onChange={(e) => setSleep(e.target.value)} style={{ width: 140 }} aria-label="Schlafdauer in Stunden" />
          <button className="btn">{row?.sleep_hours != null ? "Ändern" : "Speichern"}</button>
        </div>
        <div className="row small"><span className="muted">Wie erholt fühlst du dich?</span>
          <div className="faces">
            {SLEEP_FACES.map((f, i) => (
              <button type="button" key={i} aria-pressed={row?.sleep_quality === i + 1} aria-label={`Erholung ${i + 1} von 5`} onClick={() => updateDaily(daily, day, { sleep_quality: i + 1 })}>{f}</button>
            ))}
          </div>
        </div>
      </form>

      {withSteps.length > 0 && (
        <section className="card grid">
          <div className="row"><h3>Schritte – 14 Tage</h3><span className="spacer" /><span className="small muted">Ø {fmt(withSteps.reduce((a, b) => a + b, 0) / withSteps.length)}</span></div>
          <BarChart days={last} values={stepVals} goal={STEPS_GOAL} label="Schritte der letzten 14 Tage" />
        </section>
      )}
      {sleepPts.length > 1 && (
        <section className="card grid">
          <div className="row"><h3>Schlaf</h3><span className="spacer" /><span className="small muted">Ø {formatDuration(sleepPts.reduce((a, b) => a + b.v, 0) / sleepPts.length)}</span></div>
          <LineChart label="Schlafdauer" series={[{ cls: "s-a", points: sleepPts }]} refs={[{ v: 7, cls: "r-goal" }]} />
        </section>
      )}
    </>
  );
}

/* ---------- Blutdruck ---------- */

function Pressure() {
  const list = useMeasurements("bp");
  const [sys, setSys] = useState(""), [dia, setDia] = useState(""), [pulse, setPulse] = useState("");
  const [day, setDay] = useState(dayKey()), [time, setTime] = useState(nowTime());
  const [range, setRange] = useState<"30" | "90" | "all">("30");

  function save(e: React.FormEvent) {
    e.preventDefault();
    const s = parseNum(sys), d = parseNum(dia), p = parseNum(pulse);
    if (!s || !d || s < 60 || s > 260 || d < 30 || d > 160) return toast("Bitte oberen und unteren Wert eingeben, z. B. 128 und 82");
    if (d >= s) return toast("Der obere Wert muss größer sein als der untere");
    saveMeasurement({ kind: "bp", day, time, v1: s, v2: d, v3: p && p > 25 && p < 250 ? p : null });
    const r = rateBP(s, d);
    setSys(""); setDia(""); setPulse("");
    toast(`Gespeichert – ${r.label}`);
  }

  const week = list.filter((m) => diffDays(m.day, dayKey()) < 7);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const shown = range === "all" ? list : list.filter((m) => diffDays(m.day, dayKey()) <= Number(range));
  const latest = list.reduce<Measurement | undefined>((a, b) => (!a || b.created_at > a.created_at ? b : a), undefined);
  const veryHigh = latest && rateBP(latest.v1, latest.v2 ?? 0).label === "Sehr hoch" && diffDays(latest.day, dayKey()) <= 1;

  return (
    <>
      <form className="card grid" onSubmit={save}>
        <h2>Blutdruck messen</h2>
        <div className="bpin">
          <label className="f">Oben<input type="text" inputMode="numeric" placeholder="128" value={sys} onChange={(e) => setSys(e.target.value)} /></label>
          <span className="slash">/</span>
          <label className="f">Unten<input type="text" inputMode="numeric" placeholder="82" value={dia} onChange={(e) => setDia(e.target.value)} /></label>
          <label className="f">Puls<input type="text" inputMode="numeric" placeholder="68" value={pulse} onChange={(e) => setPulse(e.target.value)} /></label>
        </div>
        <DayTime day={day} setDay={setDay} time={time} setTime={setTime} />
        <button className="btn primary">Speichern</button>
        <p className="small muted" style={{ margin: 0 }}>Tipp: Morgens vor dem Frühstück und abends messen, jeweils nach 5 Minuten ruhig Sitzen.</p>
      </form>

      {veryHigh && <div className="notice err">Dein letzter Wert war sehr hoch. Miss nach ein paar Minuten Ruhe noch einmal. Bleibt er so hoch oder hast du Beschwerden wie Brustschmerz, Atemnot oder Kopfschmerzen, ruf bitte ärztliche Hilfe (Notruf 112).</div>}

      {week.length > 0 && (
        <section className="card grid" style={{ gap: 10 }}>
          <h3>Durchschnitt 7 Tage</h3>
          <div className="stats">
            {(() => {
              const s = avg(week.map((m) => m.v1)), d = avg(week.map((m) => m.v2 ?? 0));
              const pulses = week.map((m) => m.v3).filter((v): v is number => v !== null);
              const r = rateBP(s, d);
              return <>
                <div className="stat"><b>{fmt(s)}/{fmt(d)}</b><span>mmHg <Pill level={r.level}>{r.label}</Pill></span></div>
                {pulses.length > 0 && <div className="stat"><b>{fmt(avg(pulses))}</b><span>Puls</span></div>}
                <div className="stat"><b>{week.length}</b><span>Messungen</span></div>
              </>;
            })()}
          </div>
        </section>
      )}

      {list.length > 1 && (
        <section className="card grid">
          <div className="row"><h3>Verlauf</h3><span className="spacer" /><Seg value={range} onChange={setRange} label="Zeitraum" options={[["30", "30 Tage"], ["90", "90 Tage"], ["all", "Alles"]]} /></div>
          <LineChart label="Blutdruckverlauf" refs={[{ v: 135, cls: "r-warn" }, { v: 85, cls: "r-warn" }]} series={[
            { cls: "s-sys", points: shown.map((m) => ({ day: m.day, t: timeFrac(m.time), v: m.v1 })) },
            { cls: "s-dia", points: shown.map((m) => ({ day: m.day, t: timeFrac(m.time), v: m.v2 ?? 0 })) },
          ]} />
          <div className="row small muted"><span><i className="lg l-sys" /> Oben</span><span><i className="lg l-dia" /> Unten</span><span><i className="lg line-target" /> Grenze 135/85</span></div>
        </section>
      )}

      <MoreList items={list} render={(m) => {
        const r = rateBP(m.v1, m.v2 ?? 0);
        return (
          <div key={m.id} className="row wrow">
            <span>{formatDay(m.day)} <span className="muted small">{m.time}</span></span>
            <span className="wr">
              <b>{fmt(m.v1)}/{fmt(m.v2 ?? 0)}</b>
              {m.v3 !== null && <span className={`small ${ratePulse(m.v3).level === "good" ? "muted" : ""}`}>♥ {fmt(m.v3)}</span>}
              <Pill level={r.level}>{r.label}</Pill>
              <Confirm label="✕" onConfirm={() => remove("measurements", [m])} />
            </span>
          </div>
        );
      }} />
    </>
  );
}

/* ---------- Blutzucker ---------- */

function Sugar() {
  const list = useMeasurements("glucose");
  const [v, setV] = useState("");
  const [tag, setTag] = useState(GLUCOSE_TAGS[0][0]);
  const [day, setDay] = useState(dayKey()), [time, setTime] = useState(nowTime());

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNum(v);
    if (!n || n < 20 || n > 600) return toast("Bitte den Wert in mg/dl eingeben, z. B. 95");
    saveMeasurement({ kind: "glucose", day, time, v1: n, tag });
    setV("");
    toast(`Gespeichert – ${rateGlucose(n, tag).label}`);
  }

  const fasting = list.filter((m) => m.tag === "nuechtern");
  return (
    <>
      <form className="card grid" onSubmit={save}>
        <h2>Blutzucker messen</h2>
        <div className="row">
          <input type="text" inputMode="decimal" placeholder="mg/dl, z. B. 95" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 160 }} aria-label="Blutzucker in mg/dl" />
        </div>
        <Seg value={tag} onChange={setTag} options={GLUCOSE_TAGS} label="Zeitpunkt" />
        <DayTime day={day} setDay={setDay} time={time} setTime={setTime} />
        <button className="btn primary">Speichern</button>
      </form>

      {list.length > 1 && (
        <section className="card grid">
          <h3>Verlauf</h3>
          <LineChart label="Blutzuckerverlauf" refs={[{ v: 100, cls: "r-warn" }, { v: 140, cls: "r-warn" }]} series={[
            { cls: "s-a", points: fasting.map((m) => ({ day: m.day, t: timeFrac(m.time), v: m.v1 })) },
            { cls: "s-b", line: false, points: list.filter((m) => m.tag !== "nuechtern").map((m) => ({ day: m.day, t: timeFrac(m.time), v: m.v1 })) },
          ]} />
          <div className="row small muted"><span><i className="lg l-a" /> Nüchtern</span><span><i className="lg dot-b" /> Andere</span><span><i className="lg line-target" /> 100 / 140 mg/dl</span></div>
        </section>
      )}

      <MoreList items={list} render={(m) => {
        const r = rateGlucose(m.v1, m.tag);
        return (
          <div key={m.id} className="row wrow">
            <span>{formatDay(m.day)} <span className="muted small">{m.time} · {glucoseTagLabel(m.tag)}</span></span>
            <span className="wr">
              <b>{fmt(m.v1)}</b>
              <Pill level={r.level}>{r.label}</Pill>
              <Confirm label="✕" onConfirm={() => remove("measurements", [m])} />
            </span>
          </div>
        );
      }} />
    </>
  );
}

/* ---------- Körpermaße ---------- */

function Body({ settings }: { settings: Settings }) {
  const all = useStore((s) => s.data.measurements);
  const body = all.filter((m) => BODY_KINDS.some(([k]) => k === m.kind)).sort(sortDesc);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [day, setDay] = useState(dayKey());

  function save(e: React.FormEvent) {
    e.preventDefault();
    let n = 0;
    for (const [kind, label] of BODY_KINDS) {
      const raw = vals[kind];
      if (!raw?.trim()) continue;
      const v = parseNum(raw);
      const ok = kind === "bodyfat" ? v !== null && v > 2 && v < 70 : v !== null && v > 30 && v < 250;
      if (!ok) return toast(`Bitte bei „${label}“ eine gültige Zahl eingeben`);
      // Pro Tag und Maß nur ein Wert
      const old = body.find((m) => m.kind === kind && m.day === day);
      upsert("measurements", [{ id: old?.id ?? newId(), owner: ownerId(), kind, day, time: "", v1: v!, v2: null, v3: null, tag: "", note: "", created_at: old?.created_at ?? new Date().toISOString() }]);
      n++;
    }
    if (!n) return toast("Bitte mindestens einen Wert eingeben");
    setVals({});
    toast("Gespeichert");
  }

  const series = (kind: MeasureKind) => body.filter((m) => m.kind === kind);
  const waist = series("waist");
  const latestWaist = waist[0];
  const wr = latestWaist ? rateWaist(latestWaist.v1, settings.height_cm) : null;
  const chartKinds = BODY_KINDS.filter(([k]) => k !== "bodyfat" && series(k).length > 0);
  const days = [...new Set(body.map((m) => m.day))];

  return (
    <>
      <form className="card grid" onSubmit={save}>
        <h2>Maße eintragen</h2>
        <div className="fields">
          {BODY_KINDS.map(([kind, label, unit]) => (
            <label key={kind} className="f">{label} ({unit})
              <input type="text" inputMode="decimal" value={vals[kind] ?? ""} onChange={(e) => setVals({ ...vals, [kind]: e.target.value })} />
            </label>
          ))}
        </div>
        <DayTime day={day} setDay={setDay} />
        <button className="btn primary">Speichern</button>
        <p className="small muted" style={{ margin: 0 }}>So misst du richtig: <b>Taille</b> an der schmalsten Stelle zwischen Rippen und Hüftknochen, <b>Bauch</b> auf Höhe des Bauchnabels, <b>Hüfte</b> an der breitesten Stelle. Morgens, entspannt ausatmen, Maßband locker anlegen.</p>
      </form>

      {body.length > 0 && (
        <section className="card grid">
          <div className="stats">
            {BODY_KINDS.map(([kind, label, unit]) => {
              const s = series(kind);
              if (!s.length) return null;
              const diff = s[0].v1 - s[s.length - 1].v1;
              return (
                <div key={kind} className="stat"><b>{fmt(s[0].v1, unit === "%" ? 1 : 0)}</b>
                  <span>{unit} {label}{s.length > 1 && Math.abs(diff) >= 0.1 ? ` (${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff), 1)})` : ""}</span></div>
              );
            })}
          </div>
          {wr && (
            <div className="row small"><span>Taille im Verhältnis zur Größe: <b>{fmt(wr.ratio, 2)}</b></span><Pill level={wr.level}>{wr.label}</Pill>
              <span className="muted">Unter 0,5 gilt als gesund – ein guter Hinweis auf Bauchfett.</span></div>
          )}
        </section>
      )}

      {chartKinds.length > 0 && body.filter((m) => m.kind !== "bodyfat").length > 1 && (
        <section className="card grid">
          <h3>Verlauf</h3>
          <LineChart label="Verlauf der Körpermaße" series={chartKinds.map(([k], i) => ({ cls: ["s-a", "s-b", "s-c"][i], points: series(k).map((m) => ({ day: m.day, v: m.v1 })) }))} />
          <div className="row small muted">{chartKinds.map(([k, l], i) => <span key={k}><i className={`lg l-${["a", "b", "c"][i]}`} /> {l}</span>)}</div>
        </section>
      )}

      <MoreList items={days} render={(d) => (
        <div key={d} className="wrow2">
          <div><div>{formatDay(d)}</div>
          <span className="small muted">{BODY_KINDS.map(([k, l, u]) => { const m = body.find((x) => x.kind === k && x.day === d); return m ? `${l} ${fmt(m.v1, u === "%" ? 1 : 0)}${u === "%" ? " %" : ""}` : null; }).filter(Boolean).join(" · ")}</span></div>
          <Confirm label="✕" onConfirm={() => remove("measurements", body.filter((m) => m.day === d))} />
        </div>
      )} />
    </>
  );
}

/* ---------- Laborwerte ---------- */

function Labs({ settings }: { settings: Settings }) {
  const labs = useStore((s) => s.data.labs);
  const [name, setName] = useState(LABS[0].name);
  const [custom, setCustom] = useState("");
  const [unit, setUnit] = useState("");
  const [v, setV] = useState("");
  const [day, setDay] = useState(dayKey());
  const isCustom = name === "__eigener";
  const def = isCustom ? undefined : labDef(name);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNum(v);
    const nm = isCustom ? custom.trim() : name;
    if (!nm) return toast("Bitte einen Namen für den Wert eingeben");
    if (n === null || n < 0) return toast("Bitte einen Wert eingeben");
    const known = labDef(nm);
    upsert("labs", [{ id: newId(), owner: ownerId(), day, name: known?.name ?? nm, value: n, unit: known?.unit ?? unit.trim(), note: "", created_at: new Date().toISOString() }]);
    setV("");
    toast("Gespeichert");
  }

  // Nach Namen gruppieren, neueste Werte zuerst
  const groups = new Map<string, Lab[]>();
  for (const l of [...labs].sort((a, b) => b.day.localeCompare(a.day))) groups.set(l.name, [...(groups.get(l.name) ?? []), l]);
  const order = [...groups.keys()].sort((a, b) => {
    const ia = LABS.findIndex((l) => l.name === a), ib = LABS.findIndex((l) => l.name === b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const lastDay = labs.length ? labs.reduce((a, b) => (a.day > b.day ? a : b)).day : null;

  return (
    <>
      <form className="card grid" onSubmit={save}>
        <h2>Laborwert eintragen</h2>
        <label className="f">Wert
          <select value={name} onChange={(e) => setName(e.target.value)}>
            {LABS.map((l) => <option key={l.name} value={l.name}>{l.name} ({l.unit})</option>)}
            <option value="__eigener">Anderer Wert …</option>
          </select>
        </label>
        {def && <span className="small muted">{def.info}</span>}
        {isCustom && (
          <div className="fields">
            <label className="f">Name<input type="text" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="z. B. Ferritin" /></label>
            <label className="f">Einheit<input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="z. B. ng/ml" /></label>
          </div>
        )}
        <div className="row">
          <input type="text" inputMode="decimal" placeholder={def ? `in ${def.unit}` : "Wert"} value={v} onChange={(e) => setV(e.target.value)} style={{ width: 140 }} aria-label="Messwert" />
          <DayTime day={day} setDay={setDay} />
        </div>
        <button className="btn primary">Speichern</button>
        <p className="small muted" style={{ margin: 0 }}>Achte auf die Einheit im Laborbericht. Steht dort z. B. mmol/l statt mg/dl, wähle „Anderer Wert …“ oder frag mich, dann rechne ich um.</p>
      </form>

      {lastDay && <p className="small muted center" style={{ margin: 0 }}>Letzte Blutabnahme: {formatDate(lastDay)}</p>}

      {order.map((nm) => {
        const list = groups.get(nm)!;
        const d = labDef(nm);
        const r = d?.rate?.(list[0].value, settings.sex);
        return (
          <section key={nm} className="card grid" style={{ gap: 6 }}>
            <div className="row"><h3>{nm}</h3><span className="spacer" /><b>{num(list[0].value)} {list[0].unit}</b>{r && <Pill level={r.level}>{r.label}</Pill>}</div>
            {list.length > 2 && <LineChart label={`Verlauf ${nm}`} series={[{ cls: "s-a", points: list.map((l) => ({ day: l.day, v: l.value })) }]} />}
            {list.map((l) => (
              <div key={l.id} className="row wrow small">
                <span>{formatDate(l.day)}</span>
                <span className="wr"><span>{num(l.value)} {l.unit}</span><Confirm label="✕" onConfirm={() => remove("labs", [l])} /></span>
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
