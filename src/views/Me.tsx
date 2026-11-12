import { useState } from "react";
import { ownerId, upsert, useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { ACTIVITY, PACES, bmi, fmt, goals, parseNum } from "../lib/calc";
import { dayKey } from "../lib/date";
import { currentKg, weightPoints } from "../lib/selectors";
import type { Settings, Sex } from "../lib/types";
import { Seg, toast } from "../components/ui";

export function ProfileForm({ initial, onSaved }: { initial?: Settings; onSaved?: () => void }) {
  const weights = useStore((s) => s.data.weights);
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "m");
  const [birth, setBirth] = useState(initial ? String(initial.birth_year) : "");
  const [height, setHeight] = useState(initial ? fmt(initial.height_cm) : "");
  const [weight, setWeight] = useState(initial ? "" : "");
  const [target, setTarget] = useState(initial ? fmt(initial.target_weight, 1) : "");
  const [activity, setActivity] = useState(initial?.activity ?? 1.375);
  const [pace, setPace] = useState(initial?.pace ?? 0.5);
  const [err, setErr] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const h = parseNum(height), w = parseNum(weight), t = parseNum(target), b = parseNum(birth);
  const targetBmi = h && t ? bmi(t, h) : null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!b || b < year - 100 || b > year - 14) return setErr("Bitte ein gültiges Geburtsjahr eingeben, z. B. 1980.");
    if (!h || h < 120 || h > 230) return setErr("Bitte die Größe in Zentimetern eingeben, z. B. 178.");
    if (!initial && (!w || w < 35 || w > 300)) return setErr("Bitte dein aktuelles Gewicht in kg eingeben, z. B. 92,4.");
    if (!t || t < 35 || t > 300) return setErr("Bitte ein Zielgewicht in kg eingeben.");
    const owner = ownerId();
    const row: Settings = {
      owner,
      sex,
      birth_year: b,
      height_cm: h,
      start_weight: initial?.start_weight ?? w!,
      start_day: initial?.start_day ?? dayKey(),
      target_weight: t,
      activity,
      pace,
      kcal_override: initial?.kcal_override ?? null,
      protein_override: initial?.protein_override ?? null,
    };
    upsert("settings", [row]);
    if (!initial && w && !weights.some((x) => x.day === dayKey())) upsert("weights", [{ owner, day: dayKey(), kg: w }]);
    toast("Gespeichert");
    onSaved?.();
  }

  return (
    <form className="grid" onSubmit={save}>
      <div className="grid" style={{ gap: 6 }}>
        <span className="lbl">Geschlecht (für den Grundumsatz)</span>
        <Seg value={sex} options={[["m", "Mann"], ["w", "Frau"]]} onChange={setSex} label="Geschlecht" />
      </div>
      <div className="fields">
        <label className="f">Geburtsjahr<input type="text" inputMode="numeric" value={birth} onChange={(e) => setBirth(e.target.value)} placeholder="z. B. 1980" /></label>
        <label className="f">Größe (cm)<input type="text" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="z. B. 178" /></label>
        {!initial && <label className="f">Gewicht heute (kg)<input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="z. B. 92,4" /></label>}
        <label className="f">Zielgewicht (kg)<input type="text" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="z. B. 80" /></label>
      </div>
      {targetBmi !== null && targetBmi < 18.5 && <div className="notice warn">Dieses Zielgewicht liegt im Untergewicht (BMI {fmt(targetBmi, 1)}). Bitte ein höheres Ziel wählen oder mit deiner Ärztin / deinem Arzt sprechen.</div>}
      <div className="grid" style={{ gap: 6 }}>
        <span className="lbl">Wie viel bewegst du dich im Alltag?</span>
        <div className="choices">
          {ACTIVITY.map(([v, l, d]) => (
            <button type="button" key={v} aria-pressed={activity === v} onClick={() => setActivity(v)}><b>{l}</b><span>{d}</span></button>
          ))}
        </div>
      </div>
      <div className="grid" style={{ gap: 6 }}>
        <span className="lbl">Wie schnell möchtest du abnehmen?</span>
        <Seg value={pace} options={PACES.map((p) => [p, `${fmt(p, 2).replace(/0$/, "")} kg / Woche`] as [number, string])} onChange={setPace} label="Tempo" />
        <span className="small muted">0,5 kg pro Woche ist ein guter, dauerhaft durchhaltbarer Wert.</span>
      </div>
      {err && <div className="notice err" role="alert">{err}</div>}
      <button className="btn primary big">{initial ? "Speichern" : "Los geht's"}</button>
    </form>
  );
}

export function Me({ settings }: { settings: Settings }) {
  const weights = useStore((s) => s.data.weights);
  const session = useStore((s) => s.session);
  const kg = currentKg(weightPoints(weights), settings);
  const g = goals(settings, kg);
  const [kcalO, setKcalO] = useState(settings.kcal_override ? String(settings.kcal_override) : "");
  const [protO, setProtO] = useState(settings.protein_override ? String(settings.protein_override) : "");

  function saveOverrides() {
    const k = parseNum(kcalO), p = parseNum(protO);
    upsert("settings", [{ ...settings, kcal_override: k ? Math.round(k) : null, protein_override: p ? Math.round(p) : null }]);
    toast("Gespeichert");
  }

  return (
    <div className="grid narrow">
      <section className="card grid">
        <h2>Deine Ziele</h2>
        <div className="stats">
          <div className="stat"><b>{fmt(g.kcal)}</b><span>kcal pro Tag</span></div>
          <div className="stat"><b>{fmt(g.protein)} g</b><span>Eiweiß pro Tag</span></div>
          <div className="stat"><b>{fmt(g.tdee)}</b><span>Verbrauch (geschätzt)</span></div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Grundumsatz {fmt(g.bmr)} kcal × Bewegung = Tagesverbrauch. Davon wird für {fmt(settings.pace, 2).replace(/0$/, "")} kg pro Woche täglich etwa {fmt((settings.pace * 7000) / 7)} kcal abgezogen.
          Die Werte passen sich an, wenn sich dein Gewicht ändert.
        </p>
        {g.limited && !settings.kcal_override && <div className="notice warn">Dein Ziel wurde auf {fmt(g.floor)} kcal begrenzt – weniger sollte man ohne ärztliche Begleitung nicht essen. Du nimmst dadurch etwas langsamer ab.</div>}
        <details>
          <summary className="small"><b>Ziele selbst festlegen</b> (z. B. nach Absprache mit Arzt oder Ernährungsberatung)</summary>
          <div className="fields" style={{ marginTop: 10 }}>
            <label className="f">kcal pro Tag<input type="text" inputMode="numeric" value={kcalO} onChange={(e) => setKcalO(e.target.value)} placeholder={`automatisch (${fmt(g.kcal)})`} /></label>
            <label className="f">Eiweiß (g)<input type="text" inputMode="numeric" value={protO} onChange={(e) => setProtO(e.target.value)} placeholder="automatisch" /></label>
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={saveOverrides}>Übernehmen</button>
        </details>
      </section>
      <section className="card grid">
        <h2>Deine Angaben</h2>
        <ProfileForm initial={settings} />
      </section>
      <section className="card grid">
        <h2>Konto</h2>
        <p className="small muted" style={{ margin: 0 }}>Angemeldet als {session?.user.email}. Die Werte in dieser App sind Schätzungen und ersetzen keine ärztliche Beratung.</p>
        <div><button className="btn" onClick={() => supabase.auth.signOut()}>Abmelden</button></div>
      </section>
    </div>
  );
}
