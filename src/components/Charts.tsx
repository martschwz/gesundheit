// Einfache Diagramme als SVG – ohne zusätzliche Bibliothek.
import { diffDays, formatDay } from "../lib/date";
import { fmt } from "../lib/calc";

export type ChartPoint = { day: string; t?: number; v: number }; // t = Tageszeit 0..1
export type Series = { cls: string; points: ChartPoint[]; line?: boolean; dots?: boolean };
export type RefLine = { v: number; cls: string };

const W = 360, H = 200, L = 34, R = 6, T = 10, B = 22;

function niceStep(range: number): number {
  for (const s of [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]) if (range / s <= 6) return s;
  return 2000;
}

export function LineChart({ series, refs = [], label }: { series: Series[]; refs?: RefLine[]; label: string }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <p className="muted small">Für ein Diagramm braucht es mindestens zwei Messungen.</p>;
  const days = all.map((p) => p.day).sort();
  const first = days[0], last = days[days.length - 1];
  const span = Math.max(1, diffDays(first, last) + (all.some((p) => p.t !== undefined) ? 1 : 0));
  const vals = all.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  // Richtwert-Linien nur einbeziehen, wenn sie in der Nähe liegen
  const pad = Math.max(1, (hi - lo) * 0.6);
  for (const r of refs) if (r.v >= lo - pad && r.v <= hi + pad) { lo = Math.min(lo, r.v); hi = Math.max(hi, r.v); }
  const step = niceStep(Math.max(1, hi - lo));
  lo = Math.floor((lo - step * 0.3) / step) * step;
  hi = Math.ceil((hi + step * 0.3) / step) * step;
  const x = (p: { day: string; t?: number }) => L + ((diffDays(first, p.day) + (p.t ?? 0)) / span) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const ticks: number[] = [];
  for (let k = lo; k <= hi + 1e-9; k += step) ticks.push(Math.round(k * 10) / 10);
  const n = all.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      {ticks.map((k) => (
        <g key={k}>
          <line x1={L} x2={W - R} y1={y(k)} y2={y(k)} className="grid-l" />
          <text x={L - 5} y={y(k) + 4} textAnchor="end" className="axis">{fmt(k, step < 1 ? 1 : 0)}</text>
        </g>
      ))}
      {refs.filter((r) => r.v >= lo && r.v <= hi).map((r, i) => <line key={i} x1={L} x2={W - R} y1={y(r.v)} y2={y(r.v)} className={`ref ${r.cls}`} />)}
      {series.map((s, si) => {
        const pts = [...s.points].sort((a, b) => a.day.localeCompare(b.day) || (a.t ?? 0) - (b.t ?? 0));
        return (
          <g key={si} className={s.cls}>
            {s.line !== false && pts.length > 1 && <path d={pts.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")} className="ln" />}
            {s.dots !== false && pts.map((p, i) => <circle key={i} cx={x(p)} cy={y(p.v)} r={n > 80 ? 1.6 : 2.6} className="dt" />)}
          </g>
        );
      })}
      <text x={L} y={H - 6} className="axis">{formatDay(first)}</text>
      <text x={W - R} y={H - 6} textAnchor="end" className="axis">{formatDay(last)}</text>
    </svg>
  );
}

/** Balken pro Tag, z. B. Schritte oder Wasser. Erreichte Ziele werden grün. */
export function BarChart({ days, values, goal, label, format = (v) => fmt(v) }: { days: string[]; values: (number | null)[]; goal?: number; label: string; format?: (v: number) => string }) {
  const max = Math.max(goal ?? 0, ...values.map((v) => v ?? 0), 1) * 1.1;
  const h = 120, w = 360, gap = 3;
  const bw = (w - gap * (days.length - 1)) / days.length;
  const y = (v: number) => h - (v / max) * h;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h + 16}`} className="chart" role="img" aria-label={label}>
        {values.map((v, i) => v ? (
          <rect key={i} x={i * (bw + gap)} y={y(v)} width={bw} height={h - y(v)} rx={3} className={goal && v >= goal ? "bar ok" : "bar"}>
            <title>{`${formatDay(days[i])}: ${format(v)}`}</title>
          </rect>
        ) : <rect key={i} x={i * (bw + gap)} y={h - 2} width={bw} height={2} rx={1} className="bar none" />)}
        {goal ? <line x1={0} x2={w} y1={y(goal)} y2={y(goal)} className="ref r-goal" /> : null}
        <text x={0} y={h + 13} className="axis">{formatDay(days[0])}</text>
        <text x={w} y={h + 13} textAnchor="end" className="axis">{formatDay(days[days.length - 1])}</text>
      </svg>
    </div>
  );
}

/** Ampel-Kennzeichnung. */
export function Pill({ level, children }: { level: "good" | "mid" | "high"; children: React.ReactNode }) {
  return <span className={`pill ${level}`}>{children}</span>;
}
