import { useEffect, useState } from "react";
import { fmt } from "../lib/calc";

let showToast: (m: string) => void = () => {};
export const toast = (m: string) => showToast(m);
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number | undefined;
    showToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 2400);
    };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Confirm({ label, confirmLabel = "Ja, löschen", onConfirm }: { label: string; confirmLabel?: string; onConfirm: () => void }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button className="btn sm ghost" onClick={() => setAsk(true)}>{label}</button>;
  return (
    <span className="row">
      <span className="small">Wirklich?</span>
      <button className="btn sm bad" onClick={() => { setAsk(false); onConfirm(); }}>{confirmLabel}</button>
      <button className="btn sm ghost" onClick={() => setAsk(false)}>Nein</button>
    </span>
  );
}

/** Kalorien-Ring: wie viel vom Tagesziel schon gegessen ist. */
export function Ring({ eaten, goal }: { eaten: number; goal: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const share = goal > 0 ? Math.min(1, eaten / goal) : 0;
  const left = Math.round(goal - eaten);
  const over = left < 0;
  return (
    <div className="ring" role="img" aria-label={`${fmt(eaten)} von ${fmt(goal)} Kalorien gegessen`}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} className="track" />
        {share > 0 && <circle cx="60" cy="60" r={r} className={`val ${over ? "over" : ""}`} strokeDasharray={`${share * c} ${c}`} transform="rotate(-90 60 60)" />}
      </svg>
      <div className="ring-label">
        <b>{fmt(Math.abs(left))}</b>
        <span>{over ? "kcal drüber" : "kcal übrig"}</span>
      </div>
    </div>
  );
}

export function Bar({ label, value, goal, unit = "g" }: { label: string; value: number; goal?: number; unit?: string }) {
  return (
    <div className="mbar">
      <div className="row small"><b>{label}</b><span className="spacer" /><span className="muted">{fmt(value)}{goal ? ` / ${fmt(goal)}` : ""} {unit}</span></div>
      {goal ? <div className="goal"><i style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} /></div> : null}
    </div>
  );
}
