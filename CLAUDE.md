# Gesundheit – Hinweise für die Weiterentwicklung

Persönliche Gesundheits- und Abnehm-App für eine Person (ein Login). Der Nutzer pflegt den Code ausschließlich über Claude; Erklärungen auf Deutsch, einfach und ohne Fachjargon. Technik und Aufbau bewusst wie bei der Lernapp (`martschwz/lernapp`).

## Technik
- React 18 + TypeScript + Vite 6, PWA über `vite-plugin-pwa`. Kein Router: `src/App.tsx` schaltet Ansichten über einen `view`-State.
- Supabase (Auth mit E-Mail/Passwort, Postgres mit RLS „owner = auth.uid()“). Nutzt das Supabase-Projekt der Lernapp mit (kostenloser Tarif erlaubt kein weiteres Projekt); eigene Tabellennamen, eigener Login, eigener Auth-`storageKey` (`gesundheit-auth`), damit sich die Apps auf derselben Domain nicht gegenseitig abmelden. Tabellennamen nie mit denen der Lernapp kollidieren lassen. Verbindungsdaten in `src/config.ts`.
- Hosting: GitHub Pages unter `/gesundheit/` (Workflow `.github/workflows/deploy.yml`, `base` in `vite.config.ts`).
- KI-Schätzung: Supabase Edge Function `supabase/functions/estimate-meal` ruft die Claude API mit `claude-haiku-5-5` auf (Wunsch des Nutzers wegen der Kosten; Secret `ANTHROPIC_API_KEY`, strukturierte Ausgabe per JSON-Schema). Der Schlüssel darf nie in den Frontend-Code. Fotos werden nicht gespeichert, nur verkleinert zur Schätzung geschickt.
- Handy des Nutzers: Xiaomi (Android) mit Honor Watch GS Pro über Huawei Health. Uhr-Daten vorerst von Hand; Huawei bietet Web-Apps keinen direkten Zugriff.

## Daten (`supabase/migrations/`)
`settings` (eine Zeile: Geschlecht, Geburtsjahr, Größe, Start-/Zielgewicht, Aktivitätsfaktor, Tempo kg/Woche, optionale eigene Ziele), `weights` (ein Wert pro Tag), `meals` (Mahlzeit mit `items` als JSON: name, amount, kcal, protein, carbs, fat; Summen zusätzlich als Spalten), `favorites`. Alle Zeilen haben `owner`.
Schemaänderungen immer als neue Datei `supabase/migrations/000N_….sql` (idempotent), neue Tabellen in `OPTIONAL_TABLES` (store.ts) aufnehmen und dem Nutzer sagen, dass er sie im SQL Editor ausführen muss.

## Wichtige Dateien
- `src/lib/store.ts` – lädt alle Daten, Cache in localStorage, Outbox-Warteschlange für Offline-Änderungen (`upsert`, `remove`). `owner` immer per `ownerId()` setzen.
- `src/lib/calc.ts` – Grundumsatz (Mifflin-St Jeor), Kalorienziel (Tempo × 7000 kcal/kg, Untergrenze 1500 Mann / 1200 Frau), Eiweißziel (1,6 g × min(Gewicht, Ziel+10)), Gewichtstrend (exponentielle Glättung 10 %/Tag), Prognose (Regression über 28 Tage).
- `src/lib/ai.ts` – Foto verkleinern und Edge Function aufrufen.
- `src/views/Today.tsx` (Kalorienring, Mahlzeiten), `MealEditor.tsx` (Foto/Text/Favorit/Hand → prüfen → speichern), `Weight.tsx` (Eingabe, Diagramm, Prognose), `Me.tsx` (Profil, Ziele, Abmelden).

## Regeln
- Vor jedem Commit: `npx tsc --noEmit`, `npm test`, `npm run build`.
- Texte in der App auf Deutsch, kurz und freundlich, nicht belehrend.
- Gesundheit: keine Ziele unter der Kalorien-Untergrenze vorschlagen, kein Untergewicht als Ziel; Hinweis, dass die App keine ärztliche Beratung ersetzt.

## Fahrplan
- **Etappe 1 (fertig):** Profil + Kalorienziel, Essen per Foto/Text/Favorit/Hand, Gewicht mit Trend und Prognose.
- **Etappe 2:** Gesundheitswerte – Bauch-/Taillenumfang, Blutdruck + Puls (mit Ampel), Schlaf, Wasser, Schritte, Blutzucker, Laborwerte; Verlaufsdiagramme.
- **Etappe 3:** KI-Coach (Wochenauswertung, Fragen wie „Was passt heute Abend noch?“), Erinnerungen (Push), Serien und Erfolge.
- **Später:** Uhr-Daten automatisch (z. B. Android-Hülle mit Capacitor + Health Connect über die App „Health Sync“).
