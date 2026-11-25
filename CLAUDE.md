# Gesundheit – Hinweise für die Weiterentwicklung

Persönliche Gesundheits- und Abnehm-App für eine Person (ein Login). Der Nutzer pflegt den Code ausschließlich über Claude; Erklärungen auf Deutsch, einfach und ohne Fachjargon. Technik und Aufbau bewusst wie bei der Lernapp (`martschwz/lernapp`).

## Technik
- React 18 + TypeScript + Vite 6, PWA über `vite-plugin-pwa`. Kein Router: `src/App.tsx` schaltet Ansichten über einen `view`-State.
- Supabase (Auth mit E-Mail/Passwort, Postgres mit RLS „owner = auth.uid()“). Nutzt das Supabase-Projekt der Lernapp mit (kostenloser Tarif erlaubt kein weiteres Projekt); eigene Tabellennamen, eigener Login, eigener Auth-`storageKey` (`gesundheit-auth`), damit sich die Apps auf derselben Domain nicht gegenseitig abmelden. Tabellennamen nie mit denen der Lernapp kollidieren lassen. Verbindungsdaten in `src/config.ts`.
- Hosting: GitHub Pages unter `/gesundheit/` (Workflow `.github/workflows/deploy.yml`, `base` in `vite.config.ts`).
- KI-Schätzung: Supabase Edge Function `supabase/functions/estimate-meal` ruft die Claude API mit `claude-haiku-5-5` auf (Wunsch des Nutzers wegen der Kosten; Secret `ANTHROPIC_API_KEY`, strukturierte Ausgabe per JSON-Schema). Der Schlüssel darf nie in den Frontend-Code. Fotos werden nicht gespeichert, nur verkleinert zur Schätzung geschickt.
- Handy des Nutzers: Xiaomi (Android) mit Honor Watch GS Pro über Huawei Health. Uhr-Daten vorerst von Hand; Huawei bietet Web-Apps keinen direkten Zugriff.

## Daten (`supabase/migrations/`)
`settings` (eine Zeile: Geschlecht, Geburtsjahr, Größe, Start-/Zielgewicht, Aktivitätsfaktor, Tempo kg/Woche, optionale eigene Ziele), `weights` (ein Wert pro Tag), `meals` (Mahlzeit mit `items` als JSON: name, amount, kcal, protein, carbs, fat; Summen zusätzlich als Spalten), `favorites`. Migration 0002: `daily` (owner+day: water_ml, steps, sleep_hours, sleep_quality 1–5), `measurements` (id, kind `bp`/`glucose`/`waist`/`belly`/`hip`/`bodyfat`, day, time, v1/v2/v3 – Blutdruck: oben/unten/Puls; Blutzucker mg/dl mit `tag` nuechtern/vor/nach/sonst), `labs` (day, name, value, unit). Migration 0003: `reminder_settings` (owner: items [{key, enabled, time}], tz), `push_subscriptions` (endpoint, subscription), nur für den Server (RLS ohne Regeln): `push_config` (VAPID-Schlüssel, wird von der Funktion erzeugt; `cron_token`), `reminder_log` (verhindert doppelte Erinnerungen); pg_cron ruft alle 15 Min. die Funktion `reminders` (action `tick`) auf. Alle Zeilen haben `owner`.
Schemaänderungen immer als neue Datei `supabase/migrations/000N_….sql` (idempotent), neue Tabellen in `OPTIONAL_TABLES` (store.ts) aufnehmen und dem Nutzer sagen, dass er sie im SQL Editor ausführen muss.

## Wichtige Dateien
- `src/lib/store.ts` – lädt alle Daten, Cache in localStorage, Outbox-Warteschlange für Offline-Änderungen (`upsert`, `remove`). `owner` immer per `ownerId()` setzen.
- `src/lib/calc.ts` – Grundumsatz (Mifflin-St Jeor), Kalorienziel (Tempo × 7000 kcal/kg, Untergrenze 1500 Mann / 1200 Frau), Eiweißziel (1,6 g × min(Gewicht, Ziel+10)), Gewichtstrend (exponentielle Glättung 10 %/Tag), Prognose (Regression über 28 Tage).
- `src/lib/ai.ts` – Foto verkleinern und Edge Function aufrufen.
- `src/lib/health.ts` – Ampel-Einordnung (Blutdruck mit Heim-Grenzen 135/85, Blutzucker, Taille/Größe, Schlaf, Laborwerte-Liste `LABS`), Wasserziel, Schrittziel.
- `src/components/Charts.tsx` – `LineChart` (mehrere Reihen, Richtwert-Linien), `BarChart`, `Pill`.
- `src/views/Values.tsx` – Seite „Werte“: Alltag (Wasser/Schritte/Schlaf), Blutdruck, Blutzucker, Maße, Labor; `WaterCard` auch auf „Heute“.
- `src/lib/achievements.ts` – Serien (`streak`) und Erfolge, nur aus vorhandenen Daten berechnet; `useAchievementToasts` meldet neue Erfolge.
- `src/lib/coachContext.ts` – Textzusammenfassung der Daten (14 Tage) für den Coach; `src/lib/coach.ts` ruft die Edge Function `coach` (claude-haiku-5-5) auf, Gesprächsverlauf nur im localStorage.
- `src/lib/push.ts` + `public/push-sw.js` (per `workbox.importScripts` im Service Worker) + Edge Function `reminders` (Verify JWT aus; `publicKey`, `test`, `tick` mit `cron_token`). `REMINDERS` definiert die Erinnerungsarten, Bedingungen stehen in der Funktion.
- `src/views/Coach.tsx` (Serien, Wochenrückblick, Chat, Erfolge), `Reminders.tsx` (in „Ich“).
- `src/views/Today.tsx` (Kalorienring, Mahlzeiten, Wasser, Serien-Hinweis), `MealEditor.tsx` (Foto/Text/Favorit/Hand → prüfen → speichern), `Weight.tsx` (Eingabe, Diagramm, Prognose), `Me.tsx` (Profil, Ziele, Abmelden).

## Regeln
- Vor jedem Commit: `npx tsc --noEmit`, `npm test`, `npm run build`.
- Texte in der App auf Deutsch, kurz und freundlich, nicht belehrend.
- Gesundheit: keine Ziele unter der Kalorien-Untergrenze vorschlagen, kein Untergewicht als Ziel; Hinweis, dass die App keine ärztliche Beratung ersetzt.

## Fahrplan
- **Etappe 1 (fertig):** Profil + Kalorienziel, Essen per Foto/Text/Favorit/Hand, Gewicht mit Trend und Prognose.
- **Etappe 2 (fertig):** Gesundheitswerte – Maße, Blutdruck + Puls (Ampel), Schlaf, Wasser, Schritte, Blutzucker, Laborwerte; Verlaufsdiagramme.
- **Etappe 3 (fertig):** KI-Coach (Wochenrückblick, Fragen), Erinnerungen per Web Push, Serien und Erfolge.
- **Später:** Uhr-Daten automatisch (z. B. Android-Hülle mit Capacitor + Health Connect über die App „Health Sync“).
