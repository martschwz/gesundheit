// Datenhaltung: Alle Daten werden beim Start geladen, im Gerät zwischengespeichert
// (offline nutzbar) und Änderungen über eine Warteschlange an Supabase geschickt,
// sobald Internet da ist.
import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { CONFIGURED } from "../config";
import type { TableName, Tables } from "./types";

type Data = { [K in TableName]: Tables[K][] };

export type State = {
  session: Session | null;
  authReady: boolean;
  loaded: boolean;
  loadError: string | null;
  schemaOutdated: boolean; // Datenbank-Update (0002_werte.sql) fehlt noch
  missing: TableName[]; // Tabellen, die es in der Datenbank noch nicht gibt
  data: Data;
  pending: number;
  online: boolean;
};

const emptyData = (): Data => ({ settings: [], weights: [], meals: [], favorites: [], daily: [], measurements: [], labs: [], reminder_settings: [] });

let state: State = {
  session: null,
  authReady: false,
  loaded: false,
  loadError: null,
  schemaOutdated: false,
  missing: [],
  data: emptyData(),
  pending: 0,
  online: navigator.onLine,
};
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getState = () => state;
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(state),
  );
}
export const ownerId = () => state.session?.user.id ?? "";

/* ---------- Schlüssel der Tabellen ---------- */
const PK: { [K in TableName]: (keyof Tables[K])[] } = {
  settings: ["owner"],
  weights: ["owner", "day"],
  meals: ["id"],
  favorites: ["id"],
  daily: ["owner", "day"],
  measurements: ["id"],
  labs: ["id"],
  reminder_settings: ["owner"],
};
function keyOf<K extends TableName>(t: K, row: Partial<Tables[K]>): string {
  return PK[t].map((k) => String(row[k])).join("|");
}

/* ---------- Gerätespeicher ---------- */
const uid = () => state.session?.user.id ?? "anon";
const cacheKey = () => `gesundheit:cache:${uid()}`;
const outboxKey = () => `gesundheit:outbox:${uid()}`;

function readLS<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* Speicher voll oder gesperrt – App läuft trotzdem weiter */
  }
}
let cacheTimer: number | undefined;
function persistCache() {
  clearTimeout(cacheTimer);
  cacheTimer = window.setTimeout(() => writeLS(cacheKey(), state.data), 300);
}

/* ---------- Warteschlange für Änderungen ---------- */
type Op = { t: TableName; kind: "upsert" | "delete"; key: string; row: Record<string, unknown> };
let outbox: Op[] = [];
let flushing = false;
let flushTimer: number | undefined;

function enqueue(op: Op) {
  outbox = outbox.filter((o) => !(o.t === op.t && o.key === op.key));
  outbox.push(op);
  writeLS(outboxKey(), outbox);
  set({ pending: outbox.length });
  clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flush, 600);
}

export async function flush() {
  if (flushing || !state.session || !outbox.length) return;
  flushing = true;
  try {
    while (outbox.length) {
      const op = outbox[0];
      if (op.kind === "upsert") {
        const batch = outbox.filter((o) => o.t === op.t && o.kind === "upsert").slice(0, 200);
        const rows = batch.map((o) => ({ ...o.row, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from(op.t).upsert(rows, { onConflict: PK[op.t].join(",") });
        if (error) throw error;
        outbox = outbox.filter((o) => !batch.includes(o));
      } else {
        let q = supabase.from(op.t).delete();
        for (const k of PK[op.t]) q = q.eq(k as string, op.row[k as string] as string);
        const { error } = await q;
        if (error) throw error;
        outbox = outbox.slice(1);
      }
      writeLS(outboxKey(), outbox);
      set({ pending: outbox.length });
    }
  } catch (e) {
    // Fehlt eine Tabelle noch (Datenbank-Update nicht ausgeführt), blockiert sie sonst alle anderen Änderungen
    const code = (e as { code?: string }).code;
    if ((code === "42P01" || code === "PGRST205") && OPTIONAL_TABLES.includes(outbox[0]?.t)) {
      const t = outbox[0].t;
      outbox = outbox.filter((o) => o.t !== t);
      writeLS(outboxKey(), outbox);
      const missing = [...new Set([...state.missing, t])];
      set({ pending: outbox.length, missing, schemaOutdated: missing.some((x) => WERTE_TABLES.includes(x)) });
      flushing = false;
      return flush();
    }
    console.warn("Synchronisation später erneut", e);
    clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flush, 15000);
  } finally {
    flushing = false;
  }
}

/* ---------- Ändern ---------- */
export function upsert<K extends TableName>(t: K, rows: Tables[K][]) {
  if (!rows.length) return;
  const list = [...state.data[t]] as Tables[K][];
  const index = new Map(list.map((r, i) => [keyOf(t, r), i]));
  for (const r of rows) {
    const k = keyOf(t, r);
    const i = index.get(k);
    if (i === undefined) {
      index.set(k, list.length);
      list.push(r);
    } else list[i] = r;
    enqueue({ t, kind: "upsert", key: k, row: r as unknown as Record<string, unknown> });
  }
  set({ data: { ...state.data, [t]: list } });
  persistCache();
}

export function remove<K extends TableName>(t: K, rows: Tables[K][]) {
  const keys = new Set(rows.map((r) => keyOf(t, r)));
  set({ data: { ...state.data, [t]: (state.data[t] as Tables[K][]).filter((r) => !keys.has(keyOf(t, r))) } });
  persistCache();
  for (const r of rows) enqueue({ t, kind: "delete", key: keyOf(t, r), row: r as unknown as Record<string, unknown> });
}

export const newId = () => crypto.randomUUID();

/* ---------- Laden ---------- */
const TABLES: TableName[] = ["settings", "weights", "meals", "favorites"];
// Tabellen aus späteren Datenbank-Updates hier eintragen: fehlen sie, läuft die App trotzdem weiter
const OPTIONAL_TABLES: TableName[] = ["daily", "measurements", "labs", "reminder_settings"];
const WERTE_TABLES: TableName[] = ["daily", "measurements", "labs"];

async function fetchAll<K extends TableName>(t: K): Promise<Tables[K][]> {
  const out: Tables[K][] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(t).select("*").range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data ?? []) as Tables[K][]));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function loadAll() {
  if (!state.session) return;
  const cached = readLS<Data | null>(cacheKey(), null);
  outbox = readLS<Op[]>(outboxKey(), []);
  if (cached) set({ data: { ...emptyData(), ...cached }, loaded: true, pending: outbox.length });
  try {
    await flush();
    const results = await Promise.all(TABLES.map((t) => fetchAll(t)));
    const data = emptyData();
    TABLES.forEach((t, i) => ((data as Record<TableName, unknown[]>)[t] = results[i]));
    const missing: TableName[] = [];
    for (const t of OPTIONAL_TABLES) {
      try {
        (data as Record<TableName, unknown[]>)[t] = await fetchAll(t);
      } catch {
        missing.push(t); // Datenbank-Update fehlt noch
      }
    }
    set({ missing, schemaOutdated: missing.some((t) => WERTE_TABLES.includes(t)) });
    // Noch nicht hochgeladene Änderungen beibehalten
    for (const op of outbox) {
      const list = data[op.t] as unknown as Record<string, unknown>[];
      const idx = list.findIndex((r) => keyOf(op.t, r as never) === op.key);
      if (op.kind === "upsert") idx >= 0 ? (list[idx] = op.row) : list.push(op.row);
      else if (idx >= 0) list.splice(idx, 1);
    }
    set({ data, loaded: true, loadError: null });
    persistCache();
  } catch (e) {
    console.warn(e);
    set({
      loaded: true,
      loadError: cached
        ? null
        : "Die Daten konnten nicht geladen werden. Ist die Datenbank schon eingerichtet (siehe Anleitung)? Prüfe auch die Internetverbindung.",
    });
  }
}

/* ---------- Anmeldung ---------- */
export function initAuth() {
  if (!CONFIGURED) {
    set({ authReady: true });
    return;
  }
  supabase.auth.getSession().then(({ data }) => {
    set({ session: data.session, authReady: true });
    if (data.session) loadAll();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    const changedUser = session?.user.id !== state.session?.user.id;
    set({ session, authReady: true });
    if (event === "SIGNED_OUT") set({ data: emptyData(), loaded: false });
    else if (changedUser && session) loadAll();
  });
  window.addEventListener("online", () => {
    set({ online: true });
    flush();
  });
  window.addEventListener("offline", () => set({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.session) flush().then(() => refreshIfIdle());
  });
}

// Beim Zurückkehren in die App den Stand von anderen Geräten holen
let busy = false;
export function setBusy(b: boolean) { busy = b; }
async function refreshIfIdle() {
  if (busy || outbox.length) return;
  await loadAll();
}
