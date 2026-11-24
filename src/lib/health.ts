// Einordnung von Gesundheitswerten als Ampel. Orientierungswerte für Erwachsene,
// keine Diagnose – Zielwerte können im Einzelfall anders sein.
import type { MeasureKind, Sex } from "./types";
import { parseNum } from "./calc";

export type Level = "good" | "mid" | "high";
export type Rating = { level: Level; label: string };

const r = (level: Level, label: string): Rating => ({ level, label });

/** Blutdruck, Grenzen für Messungen zu Hause (135/85 statt 140/90 in der Praxis). */
export function rateBP(sys: number, dia: number): Rating {
  if (sys >= 180 || dia >= 110) return r("high", "Sehr hoch");
  if (sys >= 160 || dia >= 100) return r("high", "Hoch");
  if (sys >= 135 || dia >= 85) return r("mid", "Erhöht");
  if (sys < 90 || dia < 60) return r("mid", "Niedrig");
  if (sys < 120 && dia < 80) return r("good", "Optimal");
  return r("good", "Normal");
}

export function ratePulse(p: number): Rating {
  if (p < 50) return r("mid", "Niedrig");
  if (p > 100) return r("mid", "Hoch");
  return r("good", "Normal");
}

export const GLUCOSE_TAGS: [string, string][] = [
  ["nuechtern", "Nüchtern"],
  ["vor", "Vor dem Essen"],
  ["nach", "2 Std. nach dem Essen"],
  ["sonst", "Sonstiges"],
];
export const glucoseTagLabel = (t: string) => GLUCOSE_TAGS.find(([k]) => k === t)?.[1] ?? "";

/** Blutzucker in mg/dl. */
export function rateGlucose(mgdl: number, tag: string): Rating {
  if (mgdl < 70) return r("high", "Unterzucker");
  if (tag === "nuechtern" || tag === "vor") {
    if (mgdl < 100) return r("good", "Normal");
    if (mgdl < 126) return r("mid", "Erhöht");
    return r("high", "Hoch");
  }
  if (mgdl < 140) return r("good", "Normal");
  if (mgdl < 200) return r("mid", "Erhöht");
  return r("high", "Hoch");
}

/** Taille geteilt durch Körpergröße: unter 0,5 ist gut. */
export function rateWaist(waistCm: number, heightCm: number): Rating & { ratio: number } {
  const ratio = waistCm / heightCm;
  if (ratio < 0.5) return { ...r("good", "Gut"), ratio };
  if (ratio < 0.6) return { ...r("mid", "Erhöht"), ratio };
  return { ...r("high", "Hoch"), ratio };
}

export function rateSleep(hours: number): Rating {
  if (hours >= 7 && hours <= 9.5) return r("good", "Gut");
  if (hours >= 6) return r("mid", "Etwas wenig");
  return r("high", "Zu wenig");
}

export const BODY_KINDS: [MeasureKind, string, string][] = [
  ["waist", "Taille", "cm"],
  ["belly", "Bauch", "cm"],
  ["hip", "Hüfte", "cm"],
  ["bodyfat", "Körperfett", "%"],
];

/** Wasserziel: etwa 35 ml pro kg, auf ein Glas (250 ml) gerundet, 1,5–3 Liter. */
export function waterGoal(kg: number): number {
  return Math.min(3000, Math.max(1500, Math.round((kg * 35) / 250) * 250));
}
export const STEPS_GOAL = 8000;

/** Schlafdauer lesen: "7,5", "7:30" oder "7 h 30". */
export function parseDuration(s: string): number | null {
  const t = s.trim().toLowerCase();
  const m = t.match(/^(\d{1,2})\s*(?::|h|std\.?)\s*(\d{1,2})?\s*(?:min)?$/);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  const n = parseNum(t);
  return n !== null && n >= 0 && n <= 24 ? n : null;
}

export function formatDuration(h: number): string {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1}:00 h` : `${hh}:${String(mm).padStart(2, "0")} h`;
}

/* ---------- Laborwerte ---------- */
export type LabDef = { name: string; unit: string; info: string; rate?: (v: number, sex: Sex) => Rating };

export const LABS: LabDef[] = [
  { name: "HbA1c", unit: "%", info: "Langzeit-Blutzucker. Unter 5,7 % normal.", rate: (v) => (v < 5.7 ? r("good", "Normal") : v < 6.5 ? r("mid", "Erhöht") : r("high", "Hoch")) },
  { name: "Nüchternblutzucker", unit: "mg/dl", info: "Unter 100 mg/dl normal.", rate: (v) => rateGlucose(v, "nuechtern") },
  { name: "Gesamtcholesterin", unit: "mg/dl", info: "Unter 200 mg/dl wünschenswert.", rate: (v) => (v < 200 ? r("good", "Gut") : v < 240 ? r("mid", "Erhöht") : r("high", "Hoch")) },
  { name: "LDL-Cholesterin", unit: "mg/dl", info: "Das „schlechte“ Cholesterin. Zielwert hängt vom persönlichen Risiko ab.", rate: (v) => (v < 116 ? r("good", "Gut") : v < 160 ? r("mid", "Erhöht") : r("high", "Hoch")) },
  { name: "HDL-Cholesterin", unit: "mg/dl", info: "Das „gute“ Cholesterin – hier ist mehr besser.", rate: (v, sex) => (v >= (sex === "m" ? 40 : 50) ? r("good", "Gut") : r("mid", "Niedrig")) },
  { name: "Triglyceride", unit: "mg/dl", info: "Blutfette. Unter 150 mg/dl normal.", rate: (v) => (v < 150 ? r("good", "Normal") : v < 200 ? r("mid", "Erhöht") : r("high", "Hoch")) },
  { name: "Harnsäure", unit: "mg/dl", info: "Erhöht bei Gicht-Risiko.", rate: (v, sex) => (v <= (sex === "m" ? 7 : 6) ? r("good", "Normal") : r("mid", "Erhöht")) },
  { name: "GPT (ALT)", unit: "U/l", info: "Leberwert.", rate: (v, sex) => (v <= (sex === "m" ? 50 : 35) ? r("good", "Normal") : r("mid", "Erhöht")) },
  { name: "Gamma-GT", unit: "U/l", info: "Leberwert.", rate: (v, sex) => (v <= (sex === "m" ? 60 : 40) ? r("good", "Normal") : r("mid", "Erhöht")) },
  { name: "Kreatinin", unit: "mg/dl", info: "Nierenwert." },
  { name: "eGFR", unit: "ml/min", info: "Nierenfunktion. Ab 90 normal.", rate: (v) => (v >= 90 ? r("good", "Normal") : v >= 60 ? r("mid", "Leicht vermindert") : r("high", "Vermindert")) },
  { name: "TSH", unit: "mU/l", info: "Schilddrüse. Etwa 0,4–4,0 normal.", rate: (v) => (v >= 0.4 && v <= 4 ? r("good", "Normal") : r("mid", v < 0.4 ? "Niedrig" : "Erhöht")) },
  { name: "Vitamin D", unit: "ng/ml", info: "25-OH-Vitamin D. Ab 30 ng/ml gut.", rate: (v) => (v >= 30 ? r("good", "Gut") : v >= 20 ? r("mid", "Knapp") : r("high", "Mangel")) },
];

export const labDef = (name: string) => LABS.find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
