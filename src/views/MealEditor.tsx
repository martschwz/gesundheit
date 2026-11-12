import { useEffect, useMemo, useState } from "react";
import { newId, ownerId, remove, setBusy, upsert, useStore } from "../lib/store";
import { SLOTS, fmt, parseNum, scaleItems, slotForHour, sum } from "../lib/calc";
import { estimateMeal } from "../lib/ai";
import type { Favorite, FoodItem, Meal, Slot, Source } from "../lib/types";
import type { AddMode } from "../App";
import { Confirm, Seg, toast } from "../components/ui";

type Draft = { name: string; amount: string; kcal: string; protein: string; carbs: string; fat: string };
const NUM: (keyof Draft)[] = ["kcal", "protein", "carbs", "fat"];
const toDraft = (i: FoodItem): Draft => ({ name: i.name, amount: i.amount, kcal: String(i.kcal), protein: String(i.protein), carbs: String(i.carbs), fat: String(i.fat) });
const fromDraft = (d: Draft): FoodItem => ({ name: d.name.trim(), amount: d.amount.trim(), kcal: Math.round(parseNum(d.kcal) ?? 0), protein: Math.round(parseNum(d.protein) ?? 0), carbs: Math.round(parseNum(d.carbs) ?? 0), fat: Math.round(parseNum(d.fat) ?? 0) });
const emptyDraft = (): Draft => ({ name: "", amount: "", kcal: "", protein: "", carbs: "", fat: "" });
const FACTORS: [number, string][] = [[0.5, "½"], [0.75, "¾"], [1, "1"], [1.25, "1¼"], [1.5, "1½"], [2, "2"]];

export function MealEditor({ day, meal, initialMode, onDone }: { day: string; meal?: Meal; initialMode?: AddMode; onDone: () => void }) {
  const favorites = useStore((s) => s.data.favorites);
  const [mode, setMode] = useState<AddMode>(initialMode ?? "foto");
  const [step, setStep] = useState<"input" | "review">(meal || mode === "hand" ? "review" : "input");
  // Eingabe
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusyState] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Prüfen
  const [title, setTitle] = useState(meal?.title ?? "");
  const [slot, setSlot] = useState<Slot>(meal?.slot ?? slotForHour(new Date().getHours()));
  const [items, setItems] = useState<Draft[]>(meal ? meal.items.map(toDraft) : [emptyDraft()]);
  const [factor, setFactor] = useState(1);
  const [hint, setHint] = useState("");
  const [source, setSource] = useState<Source>(meal?.source ?? "hand");
  const [fromFav, setFromFav] = useState<Favorite | null>(null);
  const [asFav, setAsFav] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const final = useMemo(() => scaleItems(items.map(fromDraft).filter((i) => i.name || i.kcal), factor), [items, factor]);
  const total = sum(final);

  function pickFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setErr(null);
  }

  async function runEstimate() {
    setBusyState(true); setBusy(true); setErr(null);
    try {
      const r = await estimateMeal({ file: mode === "foto" ? file : null, text });
      if (!r.items.length) {
        setErr(r.hint || "Auf dem Foto war kein Essen zu erkennen.");
        return;
      }
      setTitle(r.title);
      setItems(r.items.map(toDraft));
      setHint(r.hint);
      setSource(mode === "foto" ? "foto" : "text");
      setFactor(1);
      setStep("review");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyState(false); setBusy(false);
    }
  }

  function pickFavorite(f: Favorite) {
    setTitle(f.title);
    setItems(f.items.map(toDraft));
    if (f.slot) setSlot(f.slot);
    setSource("favorit");
    setFromFav(f);
    setHint("");
    setStep("review");
  }

  function save() {
    if (!final.length) return toast("Bitte mindestens eine Zeile ausfüllen");
    const t = title.trim() || final.map((i) => i.name).join(", ").slice(0, 60);
    const row: Meal = {
      id: meal?.id ?? newId(),
      owner: ownerId(),
      day: meal?.day ?? day,
      slot,
      title: t,
      items: final,
      ...total,
      source,
      created_at: meal?.created_at ?? new Date().toISOString(),
    };
    upsert("meals", [row]);
    if (fromFav) upsert("favorites", [{ ...fromFav, uses: fromFav.uses + 1 }]);
    if (asFav) upsert("favorites", [{ id: newId(), owner: row.owner, title: t, slot, items: final, ...total, uses: 1, created_at: new Date().toISOString() }]);
    toast(meal ? "Geändert" : "Eingetragen");
    onDone();
  }

  const setItem = (i: number, patch: Partial<Draft>) => setItems((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  if (step === "input") {
    const favs = favorites
      .filter((f) => !search.trim() || f.title.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.uses - a.uses || a.title.localeCompare(b.title));
    return (
      <div className="grid narrow">
        <div className="row"><button className="btn sm ghost" onClick={onDone}>‹ Zurück</button><span className="spacer" />
          <Seg value={mode} options={[["foto", "📷 Foto"], ["text", "✏️ Text"], ["favorit", "⭐ Favoriten"]]} onChange={(m) => { setMode(m); setErr(null); }} label="Eingabeart" />
        </div>

        {mode === "foto" && (
          <section className="card grid">
            {!preview ? (
              <label className="drop">
                <span style={{ fontSize: "2.4rem" }}>📷</span>
                <b>Mahlzeit fotografieren</b>
                <span className="small muted">Am besten von schräg oben, ganzer Teller im Bild.</span>
                <input type="file" accept="image/*" capture="environment" className="sr" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            ) : (
              <>
                <img src={preview} alt="Dein Foto" className="photo" />
                <label className="f">Notiz (optional)
                  <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. halbe Portion, ohne Soße, mit 1 EL Öl gebraten" />
                </label>
                <div className="row">
                  <button className="btn primary big" disabled={busy} onClick={runEstimate}>{busy ? "Wird geschätzt …" : "Kalorien schätzen"}</button>
                  <label className="btn ghost">Anderes Foto<input type="file" accept="image/*" capture="environment" className="sr" onChange={(e) => pickFile(e.target.files?.[0])} /></label>
                </div>
              </>
            )}
          </section>
        )}

        {mode === "text" && (
          <section className="card grid">
            <label className="f">Was hast du gegessen oder getrunken?
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"z. B. 2 Brötchen mit Butter und Gouda, 1 Kaffee mit Milch"} />
            </label>
            <div className="row">
              <button className="btn primary big" disabled={busy || !text.trim()} onClick={runEstimate}>{busy ? "Wird geschätzt …" : "Kalorien schätzen"}</button>
              <button className="btn ghost" onClick={() => { setSource("hand"); setStep("review"); }}>Lieber selbst eintragen</button>
            </div>
          </section>
        )}

        {mode === "favorit" && (
          <section className="card grid">
            {favorites.length > 6 && <input type="text" placeholder="Suchen …" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Favoriten durchsuchen" />}
            {!favorites.length && <p className="muted" style={{ margin: 0 }}>Noch keine Favoriten. Tippe bei einer eingetragenen Mahlzeit auf ☆ oder setze beim Speichern den Haken „Als Favorit merken“.</p>}
            <div className="grid" style={{ gap: 6 }}>
              {favs.map((f) => (
                <div key={f.id} className="meal">
                  <button className="meal-main" onClick={() => pickFavorite(f)}><b>{f.title}</b><span className="small muted">{f.items.map((i) => i.name).join(", ")}</span></button>
                  <span className="kcal">{fmt(f.kcal)}</span>
                  <div className="meal-actions"><Confirm label="✕" onConfirm={() => remove("favorites", [f])} /></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {busy && <p className="muted center small">Claude schaut sich deine Mahlzeit an. Das dauert ein paar Sekunden …</p>}
        {err && <div className="notice err" role="alert">{err}</div>}
        <button className="btn ghost" onClick={() => { setSource("hand"); setStep("review"); }}>Ganz ohne KI von Hand eintragen</button>
      </div>
    );
  }

  return (
    <div className="grid narrow">
      <div className="row"><button className="btn sm ghost" onClick={meal ? onDone : () => setStep("input")}>‹ Zurück</button></div>
      <section className="card grid">
        <h2>{meal ? "Mahlzeit ändern" : "Prüfen und speichern"}</h2>
        {hint && <div className="notice">💡 {hint}</div>}
        <label className="f">Name<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Müsli mit Joghurt" /></label>
        <Seg value={slot} options={SLOTS} onChange={setSlot} label="Mahlzeit" />

        <div className="grid" style={{ gap: 8 }}>
          {items.map((d, i) => (
            <div key={i} className="item">
              <div className="item-top">
                <input type="text" value={d.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Lebensmittel" aria-label="Lebensmittel" />
                <input type="text" value={d.amount} onChange={(e) => setItem(i, { amount: e.target.value })} placeholder="Menge" aria-label="Menge" className="amt" />
                <button className="btn sm ghost" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label="Zeile entfernen">✕</button>
              </div>
              <div className="item-nums">
                {NUM.map((k) => (
                  <label key={k}><span>{k === "kcal" ? "kcal" : k === "protein" ? "Eiweiß" : k === "carbs" ? "KH" : "Fett"}</span>
                    <input type="text" inputMode="numeric" value={d[k]} onChange={(e) => setItem(i, { [k]: e.target.value })} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div><button className="btn sm" onClick={() => setItems((l) => [...l, emptyDraft()])}>+ Zeile</button></div>
        </div>

        <div className="grid" style={{ gap: 6 }}>
          <span className="lbl">Portion anpassen</span>
          <Seg value={factor} options={FACTORS} onChange={setFactor} label="Portion" />
        </div>

        <div className="total">
          <b>{fmt(total.kcal)} kcal</b>
          <span className="small muted">Eiweiß {fmt(total.protein)} g · KH {fmt(total.carbs)} g · Fett {fmt(total.fat)} g</span>
        </div>

        {!meal && source !== "favorit" && (
          <label className="check"><input type="checkbox" checked={asFav} onChange={(e) => setAsFav(e.target.checked)} /> Als Favorit merken (für schnelles Eintragen)</label>
        )}
        <button className="btn primary big" onClick={save}>{meal ? "Änderung speichern" : "Speichern"}</button>
      </section>
    </div>
  );
}
