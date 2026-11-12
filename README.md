# Gesundheit

Persönliche App zum Abnehmen und gesund leben.

- **Essen per Foto:** Mahlzeit fotografieren, die KI (Claude) schätzt Kalorien, Eiweiß, Kohlenhydrate und Fett. Alles lässt sich korrigieren. Geht auch per Text oder von Hand, häufige Mahlzeiten als Favoriten.
- **Kalorienziel:** wird aus Größe, Alter, Gewicht, Bewegung und Wunschtempo berechnet und passt sich an.
- **Gewicht:** mit geglätteter Trendlinie, Fortschritt und Prognose („Ziel erreicht voraussichtlich am …“).
- Läuft im Browser auf dem Handy und lässt sich wie eine App auf den Startbildschirm legen. Funktioniert auch offline (Änderungen werden nachgereicht).

**Adresse:** https://martschwz.github.io/gesundheit/

## Einrichtung (einmalig)

### 1. Supabase-Projekt anlegen
1. Auf supabase.com einloggen → **New project**. Name z. B. `gesundheit`, Region **Frankfurt (eu-central-1)**, ein Datenbank-Passwort vergeben (wird später nicht gebraucht).
2. Unter **Project Settings → API Keys** den **Publishable key** kopieren und unter **Project Settings → Data API** die **Project URL**. Beides an Claude schicken – Claude trägt es in `src/config.ts` ein.

### 2. Datenbank anlegen
1. In Supabase links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) einfügen und auf **Run** klicken.
3. Es sollte „Success. No rows returned“ erscheinen.

### 3. Anmeldung einstellen
In Supabase unter **Authentication → URL Configuration**:
- **Site URL:** `https://martschwz.github.io/gesundheit/`
- Bei **Redirect URLs** dieselbe Adresse hinzufügen.

### 4. Veröffentlichung auf GitHub Pages einschalten
Im GitHub-Projekt unter **Settings → Pages** bei **Source** „**GitHub Actions**“ auswählen. Danach wird die App bei jeder Änderung automatisch neu veröffentlicht.

Hinweis: GitHub Pages geht mit dem kostenlosen GitHub-Konto nur bei **öffentlichen** Projekten. Das ist unbedenklich – öffentlich ist nur der Programmcode, deine Gesundheitsdaten liegen geschützt in Supabase und sind nur mit deinem Login sichtbar.

### 5. KI-Schätzung
1. In Supabase links **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name: `estimate-meal`. Den Inhalt von [`supabase/functions/estimate-meal/index.ts`](supabase/functions/estimate-meal/index.ts) einfügen und **Deploy** klicken.
3. Unter **Edge Functions → Secrets** ein Secret anlegen: Name `ANTHROPIC_API_KEY`, Wert = dein Schlüssel `sk-ant-…` (derselbe wie bei der Lernapp geht).

Kosten: etwa 1–3 Cent pro Foto. Ein Ausgabenlimit in der Anthropic-Konsole verhindert Überraschungen.

## Entwicklung

```bash
npm install
npm run dev     # lokal starten
npm test        # Tests
npm run build   # fertige App in dist/
```

Aufbau: siehe [CLAUDE.md](CLAUDE.md).
