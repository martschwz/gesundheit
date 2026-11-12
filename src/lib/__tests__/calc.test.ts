import { describe, expect, it } from "vitest";
import { bmr, forecast, goals, parseNum, scaleItems, slotForHour, sum, trend } from "../calc";
import { addDays, diffDays, formatDay } from "../date";
import type { Settings } from "../types";

const base: Settings = {
  owner: "x", sex: "m", birth_year: 1980, height_cm: 180, start_weight: 100, start_day: "2026-01-01",
  target_weight: 85, activity: 1.375, pace: 0.5, kcal_override: null, protein_override: null,
};

describe("Kalorienbedarf", () => {
  it("rechnet den Grundumsatz nach Mifflin-St Jeor", () => {
    // 10*100 + 6.25*180 - 5*46 + 5 = 1900
    expect(bmr(base, 100, 2026)).toBe(1900);
    expect(bmr({ ...base, sex: "w" }, 100, 2026)).toBe(1734);
  });
  it("zieht für 0,5 kg/Woche 500 kcal ab und rundet auf 10", () => {
    const g = goals(base, 100, 2026);
    expect(g.tdee).toBe(2613);
    expect(g.kcal).toBe(2110);
    expect(g.limited).toBe(false);
  });
  it("geht nicht unter die Untergrenze", () => {
    const g = goals({ ...base, sex: "w", height_cm: 155, activity: 1.2, pace: 0.75 }, 60, 2026);
    expect(g.kcal).toBe(1200);
    expect(g.limited).toBe(true);
  });
  it("übernimmt eigene Ziele", () => {
    expect(goals({ ...base, kcal_override: 1800, protein_override: 140 }, 100).kcal).toBe(1800);
    expect(goals({ ...base, kcal_override: 1800, protein_override: 140 }, 100).protein).toBe(140);
  });
  it("Eiweiß richtet sich nach Ziel- statt nach hohem Gewicht", () => {
    expect(goals(base, 100, 2026).protein).toBe(152); // 1,6 × 95
  });
});

describe("Gewichtstrend", () => {
  it("glättet Ausreißer", () => {
    const t = trend([{ day: "2026-01-01", kg: 100 }, { day: "2026-01-02", kg: 102 }]);
    expect(t[1].trend).toBeCloseTo(100.2);
  });
  it("berücksichtigt Lücken", () => {
    const t = trend([{ day: "2026-01-01", kg: 100 }, { day: "2026-01-11", kg: 98 }]);
    expect(t[1].trend).toBeCloseTo(100 - 2 * (1 - 0.9 ** 10));
  });
  it("sortiert nach Datum", () => {
    const t = trend([{ day: "2026-01-02", kg: 99 }, { day: "2026-01-01", kg: 100 }]);
    expect(t[0].day).toBe("2026-01-01");
  });
});

describe("Prognose", () => {
  const days = Array.from({ length: 28 }, (_, i) => ({ day: addDays("2026-01-01", i), kg: 100 - i * 0.1 }));
  it("schätzt Tempo und Zieldatum", () => {
    const f = forecast(trend(days), 95);
    expect(f.perWeek).toBeLessThan(-0.3);
    expect(f.date).not.toBeNull();
    expect(f.date! > "2026-01-28").toBe(true);
  });
  it("braucht genug Daten", () => {
    expect(forecast(trend(days.slice(0, 3)), 95).date).toBeNull();
  });
  it("erkennt erreichtes Ziel", () => {
    expect(forecast(trend(days), 99).reached).toBe(true);
  });
  it("kein Datum bei Stillstand", () => {
    const flat = days.map((d) => ({ ...d, kg: 100 }));
    expect(forecast(trend(flat), 95).date).toBeNull();
  });
});

describe("Hilfen", () => {
  it("liest Zahlen mit Komma", () => {
    expect(parseNum("92,4")).toBe(92.4);
    expect(parseNum("")).toBeNull();
    expect(parseNum("abc")).toBeNull();
  });
  it("summiert und skaliert Portionen", () => {
    const items = [{ name: "Brot", amount: "1 Scheibe", kcal: 100, protein: 4, carbs: 18, fat: 1 }];
    expect(sum(scaleItems(items, 1.5)).kcal).toBe(150);
    expect(scaleItems(items, 1)).toBe(items);
  });
  it("ordnet die Uhrzeit einer Mahlzeit zu", () => {
    expect(slotForHour(7)).toBe("fruehstueck");
    expect(slotForHour(12)).toBe("mittag");
    expect(slotForHour(19)).toBe("abend");
    expect(slotForHour(16)).toBe("snack");
  });
  it("rechnet mit Tagen", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(diffDays("2026-01-01", "2026-12-31")).toBe(364);
    expect(formatDay("2026-11-11", "2026-11-12")).toBe("Gestern");
  });
});
