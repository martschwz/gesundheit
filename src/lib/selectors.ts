import { trend, type TrendPoint } from "./calc";
import type { Settings, Weight } from "./types";

/** Gewichtsverlauf mit Trend; ohne Einträge zählt das Startgewicht. */
export function weightPoints(weights: Weight[]): TrendPoint[] {
  return trend(weights);
}

/** Aktuelles Gewicht für die Berechnungen: geglätteter Trend, sonst Startgewicht. */
export function currentKg(points: TrendPoint[], s: Settings): number {
  return points.length ? points[points.length - 1].trend : s.start_weight;
}
