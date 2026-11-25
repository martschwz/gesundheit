// Fasst die eigenen Daten kurz zusammen, damit der KI-Coach passende Antworten geben kann.
import { fmt, forecast, goals, slotLabel, sum, trend } from "./calc";
import { addDays, dayKey, diffDays, formatDay } from "./date";
import { BODY_KINDS, formatDuration, glucoseTagLabel, waterGoal } from "./health";
import type { AchData } from "./achievements";

export function coachContext(d: AchData & { favorites: { title: string; kcal: number }[] }, now = new Date()): string {
  const s = d.settings;
  const today = dayKey(now);
  const pts = trend(d.weights);
  const kg = pts.length ? pts[pts.length - 1].trend : s.start_weight;
  const g = goals(s, kg);
  const fc = forecast(pts, s.target_weight);
  const lines: string[] = [];
  const add = (l: string) => lines.push(l);

  add(`Heute: ${formatDay(today, today)}, ${now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}, ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")} Uhr`);
  add(`Person: ${s.sex === "m" ? "Mann" : "Frau"}, ${now.getFullYear() - s.birth_year} Jahre, ${fmt(s.height_cm)} cm`);
  add(`Ziel: von ${fmt(s.start_weight, 1)} kg (Start ${s.start_day}) auf ${fmt(s.target_weight, 1)} kg, Wunschtempo ${fmt(s.pace, 2)} kg/Woche`);
  add(`Tagesziele: ${g.kcal} kcal (Verbrauch geschätzt ${g.tdee} kcal, Untergrenze ${g.floor} kcal), Eiweiß ${g.protein} g, Wasser ${fmt(waterGoal(kg) / 1000, 1)} l`);
  add(`Gewicht: Trend ${fmt(kg, 1)} kg, ${fmt(s.start_weight - kg, 1)} kg seit Start${fc.perWeek !== null ? `, Tempo der letzten Wochen ${fmt(fc.perWeek, 2)} kg/Woche` : ""}${fc.date ? `, Ziel voraussichtlich ${fc.date}` : ""}`);
  const lastW = [...d.weights].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 7);
  if (lastW.length) add(`Letzte Wiegungen: ${lastW.map((w) => `${w.day.slice(5)} ${fmt(w.kg, 1)}`).join(", ")}`);

  // Heute im Detail
  const todayMeals = d.meals.filter((m) => m.day === today);
  const t = sum(todayMeals);
  add(`\nHeute gegessen: ${fmt(t.kcal)} kcal, Eiweiß ${fmt(t.protein)} g, KH ${fmt(t.carbs)} g, Fett ${fmt(t.fat)} g → noch ${fmt(g.kcal - t.kcal)} kcal und ${fmt(Math.max(0, g.protein - t.protein))} g Eiweiß übrig`);
  for (const m of todayMeals) add(`- ${slotLabel(m.slot)}: ${m.title} (${fmt(m.kcal)} kcal, ${fmt(m.protein)} g Eiweiß)`);

  // Letzte 14 Tage
  add(`\nLetzte 14 Tage (Tag: kcal / Eiweiß / Mahlzeiten / Wasser / Schritte / Schlaf):`);
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    const ms = d.meals.filter((m) => m.day === day);
    const n = sum(ms);
    const dl = d.daily.find((x) => x.day === day);
    add(`${day}: ${ms.length ? `${fmt(n.kcal)} kcal / ${fmt(n.protein)} g / ${ms.length}` : "nichts eingetragen"} / ${dl?.water_ml ? `${fmt(dl.water_ml / 1000, 1)} l` : "-"} / ${dl?.steps ?? "-"} / ${dl?.sleep_hours ? formatDuration(dl.sleep_hours) : "-"}`);
  }

  const recent = (kind: string, days: number) => d.measurements.filter((m) => m.kind === kind && diffDays(m.day, today) < days).sort((a, b) => b.day.localeCompare(a.day) || b.time.localeCompare(a.time));
  const bp = recent("bp", 14);
  if (bp.length) add(`\nBlutdruck (14 Tage): ${bp.slice(0, 10).map((m) => `${m.day.slice(5)} ${m.time} ${m.v1}/${m.v2}${m.v3 ? ` Puls ${m.v3}` : ""}`).join("; ")}`);
  const bz = recent("glucose", 30);
  if (bz.length) add(`Blutzucker (30 Tage): ${bz.slice(0, 8).map((m) => `${m.day.slice(5)} ${m.v1} mg/dl ${glucoseTagLabel(m.tag)}`).join("; ")}`);
  const body = BODY_KINDS.map(([k, l, u]) => {
    const list = d.measurements.filter((m) => m.kind === k).sort((a, b) => b.day.localeCompare(a.day));
    return list.length ? `${l} ${fmt(list[0].v1, 1)} ${u}${list.length > 1 ? ` (Start ${fmt(list[list.length - 1].v1, 1)})` : ""}` : null;
  }).filter(Boolean);
  if (body.length) add(`Maße: ${body.join(", ")}`);
  const labNames = [...new Set(d.labs.map((l) => l.name))];
  if (labNames.length) add(`Laborwerte (neueste): ${labNames.map((n) => { const l = d.labs.filter((x) => x.name === n).sort((a, b) => b.day.localeCompare(a.day))[0]; return `${n} ${l.value} ${l.unit} (${l.day})`; }).join("; ")}`);
  const favs = [...d.favorites].slice(0, 15);
  if (favs.length) add(`Gespeicherte Lieblingsmahlzeiten: ${favs.map((f) => `${f.title} (${fmt(f.kcal)} kcal)`).join("; ")}`);
  return lines.join("\n");
}
