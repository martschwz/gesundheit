// Zeigt eine kurze Meldung, sobald ein neuer Erfolg erreicht ist.
import { useEffect } from "react";
import { useStore } from "./store";
import { achievements } from "./achievements";
import { toast } from "../components/ui";

export function useAchievementToasts() {
  const d = useStore((s) => s.data);
  const uid = useStore((s) => s.session?.user.id);
  const loaded = useStore((s) => s.loaded);
  useEffect(() => {
    const settings = d.settings[0];
    if (!loaded || !uid || !settings) return;
    const done = achievements({ settings, weights: d.weights, meals: d.meals, daily: d.daily, measurements: d.measurements, labs: d.labs }).filter((a) => a.done);
    const key = `gesundheit:erfolge:${uid}`;
    let seen: string[] | null = null;
    try { seen = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { /* egal */ }
    const fresh = seen ? done.filter((a) => !seen!.includes(a.id)) : []; // Beim ersten Mal still merken
    if (fresh.length) toast(`🏆 Neuer Erfolg: ${fresh[0].icon} ${fresh[0].title}`);
    try { localStorage.setItem(key, JSON.stringify([...new Set([...(seen ?? []), ...done.map((a) => a.id)])])); } catch { /* egal */ }
  }, [d, uid, loaded]);
}
