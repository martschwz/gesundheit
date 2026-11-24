import { useState } from "react";
import { ownerId, remove, upsert, useStore } from "../lib/store";
import { bmi, fmt, forecast, parseNum } from "../lib/calc";
import { LineChart } from "../components/Charts";
import { dayKey, diffDays, formatDate, formatDay } from "../lib/date";
import { currentKg, weightPoints } from "../lib/selectors";
import type { Settings } from "../lib/types";
import { Confirm, Seg, toast } from "../components/ui";

type Range = "30" | "90" | "all";

export function WeightView({ settings }: { settings: Settings }) {
  const weights = useStore((s) => s.data.weights);
  const points = weightPoints(weights);
  const kg = currentKg(points, settings);
  const fc = forecast(points, settings.target_weight);
  const [v, setV] = useState("");
  const [day, setDay] = useState(dayKey());
  const [range, setRange] = useState<Range>("90");
  const [showAll, setShowAll] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNum(v);
    if (!n || n < 30 || n > 300) return toast("Bitte ein Gewicht in kg eingeben");
    if (day > dayKey()) return toast("Das Datum liegt in der Zukunft");
    upsert("weights", [{ owner: ownerId(), day, kg: n }]);
    setV("");
    toast("Gewicht gespeichert");
  }

  const lost = settings.start_weight - kg;
  const toGo = kg - settings.target_weight;
  const shown = range === "all" ? points : points.filter((p) => diffDays(p.day, dayKey()) <= Number(range));
  const list = [...points].reverse();

  return (
    <div className="grid narrow">
      <form className="card grid" onSubmit={save}>
        <h2>Gewicht eintragen</h2>
        <div className="row">
          <input type="text" inputMode="decimal" placeholder="kg, z. B. 91,8" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 150 }} aria-label="Gewicht in kg" />
          <input type="date" value={day} max={dayKey()} onChange={(e) => setDay(e.target.value || dayKey())} aria-label="Datum" style={{ width: "auto" }} />
          <button className="btn primary">Speichern</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Tipp: Immer morgens nach dem Aufstehen wiegen. Schwankungen von Tag zu Tag sind normal – entscheidend ist die grüne Trendlinie.</p>
      </form>

      <section className="card grid">
        <div className="stats">
          <div className="stat"><b>{fmt(kg, 1)}</b><span>kg Trend</span></div>
          <div className="stat"><b>{lost >= 0 ? "−" : "+"}{fmt(Math.abs(lost), 1)}</b><span>kg seit Start</span></div>
          <div className="stat"><b>{fmt(Math.max(0, toGo), 1)}</b><span>kg bis zum Ziel</span></div>
          <div className="stat"><b>{fmt(bmi(kg, settings.height_cm), 1)}</b><span>BMI</span></div>
        </div>
        <Progress start={settings.start_weight} now={kg} target={settings.target_weight} />
        <div className="notice">
          {fc.reached ? "🎉 Du hast dein Zielgewicht erreicht! Unter „Ich“ kannst du ein neues Ziel setzen." :
            fc.date ? <>Bei deinem Tempo ({fmt(fc.perWeek!, 2)} kg pro Woche) erreichst du dein Ziel voraussichtlich am <b>{formatDate(fc.date)}</b>.</> :
            fc.perWeek !== null ? <>Dein Gewicht ist in den letzten Wochen etwa gleich geblieben ({fc.perWeek > 0 ? "+" : ""}{fmt(fc.perWeek, 2)} kg pro Woche). Bleib dran – oft geht es nach einer Pause weiter.</> :
            "Nach etwa einer Woche mit mehreren Messungen zeige ich dir hier, wann du dein Ziel voraussichtlich erreichst."}
        </div>
      </section>

      {points.length > 1 ? (
        <section className="card grid">
          <div className="row"><h3>Verlauf</h3><span className="spacer" /><Seg value={range} options={[["30", "30 Tage"], ["90", "90 Tage"], ["all", "Alles"]]} onChange={setRange} label="Zeitraum" /></div>
          <LineChart label="Gewichtsverlauf" refs={[{ v: settings.target_weight, cls: "r-target" }]} series={[
            { cls: "s-raw", line: false, points: shown.map((p) => ({ day: p.day, v: p.kg })) },
            { cls: "s-trend", dots: false, points: shown.map((p) => ({ day: p.day, v: p.trend })) },
          ]} />
          <div className="row small muted"><span><i className="lg dot-raw" /> Messung</span><span><i className="lg line-trend" /> Trend</span><span><i className="lg line-target" /> Ziel</span></div>
        </section>
      ) : null}

      {list.length > 0 && (
        <section className="card grid" style={{ gap: 4 }}>
          <h3>Einträge</h3>
          {(showAll ? list : list.slice(0, 10)).map((p) => (
            <div key={p.day} className="row wrow">
              <span>{formatDay(p.day)}</span><span className="spacer" />
              <b>{fmt(p.kg, 1)} kg</b>
              <Confirm label="✕" onConfirm={() => remove("weights", [{ owner: ownerId(), day: p.day, kg: p.kg }])} />
            </div>
          ))}
          {!showAll && list.length > 10 && <button className="btn sm ghost" onClick={() => setShowAll(true)}>Alle {list.length} anzeigen</button>}
        </section>
      )}
    </div>
  );
}

function Progress({ start, now, target }: { start: number; now: number; target: number }) {
  const total = start - target;
  const share = total > 0 ? Math.max(0, Math.min(1, (start - now) / total)) : 0;
  return (
    <div>
      <div className="goal big"><i style={{ width: `${share * 100}%` }} /></div>
      <div className="row small muted" style={{ marginTop: 4 }}><span>Start {fmt(start, 1)} kg</span><span className="spacer" /><b className="ink">{fmt(share * 100)} % geschafft</b><span className="spacer" /><span>Ziel {fmt(target, 1)} kg</span></div>
    </div>
  );
}
