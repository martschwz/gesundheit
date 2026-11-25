import { useState } from "react";
import { useStore } from "./lib/store";
import { CONFIGURED } from "./config";
import { Login } from "./views/Login";
import { Me, ProfileForm } from "./views/Me";
import { Today } from "./views/Today";
import { MealEditor } from "./views/MealEditor";
import { WeightView } from "./views/Weight";
import { Values } from "./views/Values";
import { Coach } from "./views/Coach";
import { useAchievementToasts } from "./lib/useAchievementToasts";
import { Toaster } from "./components/ui";
import { dayKey } from "./lib/date";
import type { Meal } from "./lib/types";

export type View = "today" | "add" | "weight" | "werte" | "coach" | "me";
export type Go = (v: View, opts?: { day?: string; meal?: Meal; mode?: AddMode }) => void;
export type AddMode = "foto" | "text" | "favorit" | "hand";

export default function App() {
  const authReady = useStore((s) => s.authReady);
  const session = useStore((s) => s.session);
  const loaded = useStore((s) => s.loaded);
  const loadError = useStore((s) => s.loadError);
  const settings = useStore((s) => s.data.settings[0]);
  const pending = useStore((s) => s.pending);
  const online = useStore((s) => s.online);
  const [view, setView] = useState<View>("today");
  const [day, setDay] = useState(dayKey());
  const [meal, setMeal] = useState<Meal | undefined>();
  const [mode, setMode] = useState<AddMode | undefined>();
  const [nonce, setNonce] = useState(0);
  useAchievementToasts();

  if (!CONFIGURED) return <NotConfigured />;
  if (!authReady) return null;
  if (!session) return <><Login /><Toaster /></>;
  if (!loaded) return <main className="wrap"><div className="card narrow">Wird geladen …</div></main>;

  const go: Go = (v, opts) => {
    if (opts?.day) setDay(opts.day);
    setMeal(opts?.meal);
    setMode(opts?.mode);
    setView(v);
    setNonce((n) => n + 1);
    window.scrollTo(0, 0);
  };
  const tabs: [View, string][] = [["today", "Heute"], ["weight", "Gewicht"], ["werte", "Werte"], ["coach", "Coach"], ["me", "Ich"]];

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="topbar">
            <div className="brand"><img src={import.meta.env.BASE_URL + "icon.svg"} alt="" /><h1>Gesundheit</h1></div>
            <span className={`chip ${!online ? "warn" : pending ? "" : "ok"}`} title="Synchronisation">
              {!online ? "Offline" : pending ? "Wird gespeichert …" : "Gespeichert"}
            </span>
          </div>
          {settings && (
            <nav className="tabs" aria-label="Bereiche">
              {tabs.map(([v, l]) => <button key={v} aria-current={view === v || (v === "today" && view === "add") ? "page" : undefined} onClick={() => go(v, v === "today" ? { day: dayKey() } : undefined)}>{l}</button>)}
            </nav>
          )}
        </div>
      </header>
      <main className="wrap">
        {loadError && <div className="notice err" style={{ marginBottom: 12 }}>{loadError}</div>}
        {!settings ? (
          <section className="card grid narrow">
            <h2>Willkommen!</h2>
            <p className="muted" style={{ margin: 0 }}>Ein paar Angaben, dann rechnet die App dein persönliches Kalorienziel aus. Du kannst alles später unter „Ich“ ändern.</p>
            <ProfileForm onSaved={() => go("today", { day: dayKey() })} />
          </section>
        ) : (
          <div key={`${view}-${nonce}`}>
            {view === "today" && <Today day={day} setDay={setDay} settings={settings} go={go} />}
            {view === "add" && <MealEditor day={day} meal={meal} initialMode={mode} onDone={() => go("today")} />}
            {view === "weight" && <WeightView settings={settings} />}
            {view === "werte" && <Values settings={settings} />}
            {view === "coach" && <Coach settings={settings} />}
            {view === "me" && <Me settings={settings} />}
          </div>
        )}
      </main>
      <Toaster />
    </>
  );
}

function NotConfigured() {
  return (
    <main className="wrap">
      <section className="card grid narrow" style={{ marginTop: "8vh" }}>
        <h1>Fast fertig</h1>
        <p style={{ margin: 0 }}>Die App ist noch nicht mit der Datenbank verbunden. Die Verbindungsdaten aus Supabase müssen noch in <code>src/config.ts</code> eingetragen werden – das erledigt Claude für dich.</p>
      </section>
    </main>
  );
}
