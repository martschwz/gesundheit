import { describe, expect, it } from "vitest";
import { achievements, streak } from "../achievements";
import { coachContext } from "../coachContext";
import { addDays } from "../date";
import type { Meal, Settings } from "../types";

const settings: Settings = {
  owner: "x", sex: "m", birth_year: 1980, height_cm: 180, start_weight: 100, start_day: "2026-10-01",
  target_weight: 90, activity: 1.375, pace: 0.5, kcal_override: null, protein_override: null,
};
const meal = (day: string, kcal = 600): Meal => ({ id: day + kcal, owner: "x", day, slot: "mittag", title: "Essen", items: [], kcal, protein: 40, carbs: 50, fat: 20, source: "hand", created_at: "" });

describe("Serien", () => {
  it("zählt Tage am Stück bis heute", () => {
    expect(streak(["2026-11-23", "2026-11-24", "2026-11-25"], "2026-11-25")).toEqual({ current: 3, best: 3 });
  });
  it("läuft ab gestern weiter, wenn heute noch nichts da ist", () => {
    expect(streak(["2026-11-23", "2026-11-24"], "2026-11-25").current).toBe(2);
  });
  it("bricht bei einer Lücke ab, merkt sich aber die beste Serie", () => {
    expect(streak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-24"], "2026-11-25")).toEqual({ current: 1, best: 4 });
  });
});

describe("Erfolge", () => {
  const today = "2026-11-25";
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, -i));
  const data = {
    settings,
    weights: [{ owner: "x", day: "2026-10-01", kg: 100 }, ...days.map((d) => ({ owner: "x", day: d, kg: 96 }))],
    meals: days.flatMap((d) => [meal(d), meal(d, 700)]),
    daily: [], measurements: [], labs: [],
  };
  const list = achievements(data, today);
  const get = (id: string) => list.find((a) => a.id === id)!;
  it("erkennt erreichte Erfolge", () => {
    expect(get("start").done).toBe(true);
    expect(get("serie7").done).toBe(true);
    expect(get("serie30").done).toBe(false);
    expect(get("budget7").done).toBe(true);
    expect(get("minus1").done).toBe(true);
    expect(get("minus20")).toBeUndefined(); // Ziel sind nur 10 kg
  });
  it("zeigt Fortschritt", () => {
    expect(get("serie30").progress).toEqual([8, 30]);
  });
  it("baut eine Zusammenfassung für den Coach", () => {
    const text = coachContext({ ...data, favorites: [{ title: "Müsli", kcal: 420 }] }, new Date(2026, 10, 25, 18, 30));
    expect(text).toContain("Heute gegessen: 1.300 kcal");
    expect(text).toContain("Müsli (420 kcal)");
    expect(text).toContain("2026-11-25:");
  });
});
