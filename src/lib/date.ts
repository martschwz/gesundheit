// Tage werden als "JJJJ-MM-TT" in Ortszeit gespeichert.
const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const toUTC = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(day: string, n: number): string {
  const d = new Date(toUTC(day) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Anzahl Tage von a bis b (b später → positiv). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MO = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];

export function formatDay(day: string, today = dayKey()): string {
  const diff = diffDays(day, today);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Gestern";
  if (diff === -1) return "Morgen";
  const d = new Date(toUTC(day));
  return `${WD[d.getUTCDay()]}, ${d.getUTCDate()}. ${MO[d.getUTCMonth()]}`;
}

export function formatDate(day: string): string {
  const d = new Date(toUTC(day));
  return `${d.getUTCDate()}. ${MO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
