import { useState } from "react";
import { ownerId, remove, upsert, useStore } from "../lib/store";
import { bmi, fmt, forecast, parseNum, type TrendPoint } from "../lib/calc";
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

      {points.length > 1 && (
        <section className="card grid">
          <div className="row"><h3>Verlauf</h3><span className="spacer" /><Seg value={range} options={[["30", "30 Tage"], ["90", "90 Tage"], ["all", "Alles"]]} onChange={setRange} label="Zeitraum" /></div>
          <Chart points={shown} target={settings.target_weight} />
          <div className="row small muted"><span><i className="lg dot-raw" /> Messung</span><span><i className="lg line-trend" /> Trend</span><span><i className="lg line-target" /> Ziel</span></div>
        </section>
      )}

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

function Chart({ points, target }: { points: TrendPoint[]; target: number }) {
  if (points.length < 2) return <p className="muted small">Für diesen Zeitraum gibt es noch zu wenige Messungen.</p>;
  const W = 360, H = 200, L = 30, R = 6, T = 10, B = 22;
  const first = points[0].day, last = points[points.length - 1].day;
  const span = Math.max(1, diffDays(first, last));
  const vals = points.flatMap((p) => [p.kg, p.trend]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (target >= lo - 3) lo = Math.min(lo, target);
  lo = Math.floor(lo - 0.5); hi = Math.ceil(hi + 0.5);
  const x = (d: string) => L + (diffDays(first, d) / span) * (W - L - R);
  const y = (kg: number) => T + ((hi - kg) / (hi - lo)) * (H - T - B);
  const step = hi - lo > 12 ? 5 : hi - lo > 5 ? 2 : 1;
  const ticks: number[] = [];
  for (let k = Math.ceil(lo / step) * step; k <= hi; k += step) ticks.push(k);
  const trendPath = points.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.trend).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Gewichtsverlauf von ${formatDate(first)} bis ${formatDate(last)}`}>
      {ticks.map((k) => (
        <g key={k}>
          <line x1={L} x2={W - R} y1={y(k)} y2={y(k)} className="grid-l" />
          <text x={L - 6} y={y(k) + 4} textAnchor="end" className="axis">{k}</text>
        </g>
      ))}
      {target >= lo && target <= hi && <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} className="target" />}
      {points.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.kg)} r={points.length > 60 ? 1.6 : 2.6} className="raw" />)}
      <path d={trendPath} className="trend" />
      <text x={L} y={H - 6} className="axis">{formatDay(first)}</text>
      <text x={W - R} y={H - 6} textAnchor="end" className="axis">{formatDay(last)}</text>
    </svg>
  );
}
