# Gesundheit

Persönliche App zum Abnehmen und gesund leben.

- **Essen per Foto:** Mahlzeit fotografieren, die KI (Claude) schätzt Kalorien, Eiweiß, Kohlenhydrate und Fett. Alles lässt sich korrigieren. Geht auch per Text oder von Hand, häufige Mahlzeiten als Favoriten.
- **Kalorienziel:** wird aus Größe, Alter, Gewicht, Bewegung und Wunschtempo berechnet und passt sich an.
- **Gewicht:** mit geglätteter Trendlinie, Fortschritt und Prognose („Ziel erreicht voraussichtlich am …“).
- **Werte:** Wasser, Schritte, Schlaf, Blutdruck mit Puls, Blutzucker, Körpermaße und Laborwerte – mit Ampel und Verlaufsdiagrammen.
- **Coach:** KI-Coach für Fragen („Was passt heute Abend noch?“) und Wochenrückblick, Serien und Erfolge.
- **Erinnerungen:** Benachrichtigungen ans Handy (Wiegen, Essen, Trinken, Blutdruck, Wochenrückblick) – nur wenn nötig.
- Läuft im Browser auf dem Handy und lässt sich wie eine App auf den Startbildschirm legen. Funktioniert auch offline (Änderungen werden nachgereicht).

**Adresse:** https://martschwz.github.io/gesundheit/

## Einrichtung (einmalig)

### 1. Supabase-Projekt
Die App nutzt das Supabase-Projekt der Lernapp mit (im kostenlosen Tarif ist kein zweites Projekt möglich). Die Tabellen heißen anders, und die Daten gehören nur zum eigenen Login.

### 2. Datenbank anlegen
1. In Supabase links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) einfügen und auf **Run** klicken.
3. Es sollte „Success. No rows returned“ erscheinen. Fragt Supabase nach „Run and enable RLS“, diesen Knopf wählen.
4. Danach genauso mit [`supabase/migrations/0002_werte.sql`](supabase/migrations/0002_werte.sql) (Gesundheitswerte) und [`supabase/migrations/0003_coach.sql`](supabase/migrations/0003_coach.sql) (Erinnerungen).

### 3. Anmeldung einstellen
In Supabase unter **Authentication → URL Configuration**:
- **Site URL** bleibt die der Lernapp.
- Bei **Redirect URLs** `https://martschwz.github.io/gesundheit/` hinzufügen.

### 4. Veröffentlichung auf GitHub Pages einschalten
Im GitHub-Projekt unter **Settings → Pages** bei **Source** „**GitHub Actions**“ auswählen. Danach wird die App bei jeder Änderung automatisch neu veröffentlicht.

Hinweis: GitHub Pages geht mit dem kostenlosen GitHub-Konto nur bei **öffentlichen** Projekten. Das ist unbedenklich – öffentlich ist nur der Programmcode, deine Gesundheitsdaten liegen geschützt in Supabase und sind nur mit deinem Login sichtbar.

### 5. KI-Schätzung
1. In Supabase links **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name: `estimate-meal`. Den Inhalt von [`supabase/functions/estimate-meal/index.ts`](supabase/functions/estimate-meal/index.ts) einfügen und **Deploy** klicken.
3. Unter **Edge Functions → Secrets** ein Secret anlegen: Name `ANTHROPIC_API_KEY`, Wert = dein Schlüssel `sk-ant-…` (derselbe Schlüssel kann auch für die Lernapp genutzt werden).

Die App nutzt das günstige Modell Claude Haiku: weniger als 0,1 Cent pro Foto, also für 5 $ Guthaben mehrere tausend Fotos. Ein Ausgabenlimit in der Anthropic-Konsole verhindert Überraschungen.

### 6. KI-Coach
Wie Schritt 5, aber mit dem Namen `coach` und dem Inhalt von [`supabase/functions/coach/index.ts`](supabase/functions/coach/index.ts). Nutzt denselben Schlüssel `ANTHROPIC_API_KEY`. Kosten mit Claude Haiku: weit unter 1 Cent pro Frage.

### 7. Erinnerungen
1. In Supabase eine neue Edge Function `reminders` anlegen, Inhalt von [`supabase/functions/reminders/index.ts`](supabase/functions/reminders/index.ts), **Deploy**.
2. In den Einstellungen dieser Funktion **„Verify JWT“ / „Enforce JWT verification“ ausschalten** und speichern. (Die Funktion prüft selbst, wer sie aufruft.)
3. `0003_coach.sql` ausführen (falls noch nicht geschehen). Es richtet einen Zeitplan ein, der alle 15 Minuten nach fälligen Erinnerungen schaut.
4. In der App unter **Ich → Erinnerungen** auf „Auf diesem Handy einschalten“ tippen und Benachrichtigungen erlauben. Mit „Probe-Nachricht“ testen.

## Entwicklung

```bash
npm install
npm run dev     # lokal starten
npm test        # Tests
npm run build   # fertige App in dist/
```

Aufbau: siehe [CLAUDE.md](CLAUDE.md).
