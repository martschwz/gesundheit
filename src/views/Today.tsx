import { useState } from "react";
import { newId, ownerId, remove, upsert, useStore } from "../lib/store";
import { SLOTS, fmt, goals, parseNum, sum } from "../lib/calc";
import { addDays, dayKey, formatDay } from "../lib/date";
import { currentKg, weightPoints } from "../lib/selectors";
import type { Meal, Settings } from "../lib/types";
import type { Go } from "../App";
import { Bar, Confirm, Ring, toast } from "../components/ui";
import { WaterCard } from "./Values";
import { streak } from "../lib/achievements";

export function Today({ day, setDay, settings, go }: { day: string; setDay: (d: string) => void; settings: Settings; go: Go }) {
  const allMeals = useStore((s) => s.data.meals);
  const weights = useStore((s) => s.data.weights);
  const favorites = useStore((s) => s.data.favorites);
  const outdated = useStore((s) => s.schemaOutdated);
  const meals = allMeals.filter((m) => m.day === day).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const kg = currentKg(weightPoints(weights), settings);
  const g = goals(settings, kg);
  const total = sum(meals);
  const today = dayKey();
  const isToday = day === today;

  function toFavorite(m: Meal) {
    if (favorites.some((f) => f.title.trim().toLowerCase() === m.title.trim().toLowerCase())) return toast("Ist schon ein Favorit");
    upsert("favorites", [{ id: newId(), owner: ownerId(), title: m.title, slot: m.slot, items: m.items, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, uses: 0, created_at: new Date().toISOString() }]);
    toast("Als Favorit gespeichert ⭐");
  }

  return (
    <div className="grid narrow">
      <div className="daynav">
        <button className="btn sm" onClick={() => setDay(addDays(day, -1))} aria-label="Tag zurück">‹</button>
        <div className="center"><h2>{formatDay(day, today)}</h2>
          {isToday && (() => { const s = streak(allMeals.map((m) => m.day)); return s.current > 1 ? <button className="streakchip" onClick={() => go("coach")}>🔥 {s.current} Tage am Stück</button> : null; })()}
        </div>
        <button className="btn sm" onClick={() => setDay(addDays(day, 1))} disabled={day >= today} aria-label="Tag vor">›</button>
      </div>

      <section className="card today">
        <Ring eaten={total.kcal} goal={g.kcal} />
        <div className="grid" style={{ gap: 10, alignContent: "center" }}>
          <div className="small muted"><b className="ink">{fmt(total.kcal)}</b> von {fmt(g.kcal)} kcal gegessen</div>
          <Bar label="Eiweiß" value={total.protein} goal={g.protein} />
          <Bar label="Kohlenhydrate" value={total.carbs} />
          <Bar label="Fett" value={total.fat} />
        </div>
      </section>

      <section className="addbar" aria-label="Essen eintragen">
        <button className="btn primary big" onClick={() => go("add", { day, mode: "foto" })}>📷 Foto</button>
        <button className="btn big" onClick={() => go("add", { day, mode: "text" })}>✏️ Beschreiben</button>
        <button className="btn big" onClick={() => go("add", { day, mode: "favorit" })}>⭐ Favoriten</button>
      </section>

      {isToday && !weights.some((w) => w.day === today) && <QuickWeight />}
      {!outdated && <WaterCard day={day} settings={settings} compact />}

      {SLOTS.map(([slot, label]) => {
        const list = meals.filter((m) => m.slot === slot);
        if (!list.length) return null;
        return (
          <section key={slot} className="card grid" style={{ gap: 8 }}>
            <div className="row"><h3>{label}</h3><span className="spacer" /><span className="muted small"><b>{fmt(sum(list).kcal)}</b> kcal</span></div>
            {list.map((m) => (
              <div key={m.id} className="meal">
                <button className="meal-main" onClick={() => go("add", { day, meal: m })}>
                  <b>{m.title || "Mahlzeit"}</b>
                  <span className="small muted">{m.items.map((i) => i.name).join(", ")}</span>
                </button>
                <span className="kcal">{fmt(m.kcal)}</span>
                <div className="meal-actions">
                  <button className="btn sm ghost" onClick={() => toFavorite(m)} aria-label="Als Favorit speichern" title="Als Favorit speichern">☆</button>
                  <Confirm label="✕" onConfirm={() => remove("meals", [m])} />
                </div>
              </div>
            ))}
          </section>
        );
      })}
      {!meals.length && <p className="muted center">Noch nichts eingetragen. Fotografiere einfach deine nächste Mahlzeit.</p>}
    </div>
  );
}

function QuickWeight() {
  const [v, setV] = useState("");
  function save(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseNum(v);
    if (!kg || kg < 30 || kg > 300) return toast("Bitte ein Gewicht in kg eingeben");
    upsert("weights", [{ owner: ownerId(), day: dayKey(), kg }]);
    toast("Gewicht gespeichert");
  }
  return (
    <form className="card row" onSubmit={save}>
      <span style={{ fontWeight: 800 }}>⚖️ Heute schon gewogen?</span>
      <span className="spacer" />
      <input type="text" inputMode="decimal" placeholder="kg" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 110 }} aria-label="Gewicht in kg" />
      <button className="btn primary">Speichern</button>
    </form>
  );
}
