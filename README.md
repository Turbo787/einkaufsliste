# Gemeinsame Einkaufsliste (GitHub Pages + Supabase Realtime)

Diese Version der Einkaufsliste ist für private Nutzung in der Familie gedacht.
Die Website bleibt eine **statische GitHub-Pages-Seite** (nur `index.html`, `styles.css`, `app.js`, kein Build-Step).

## Wichtiges Prinzip

- Die Liste wird über einen Link geteilt: `?list=<uuid>`
- **Wer den Link hat, kann die Liste lesen und bearbeiten.**
- Es gibt absichtlich kein Login in dieser Prototyp-Version.

---

## 1) Supabase-Projekt anlegen

1. Öffne https://supabase.com und melde dich an.
2. Erstelle ein neues Projekt.
3. Warte, bis das Projekt bereit ist.

Du brauchst später aus **Project Settings > API**:
- `Project URL`
- `anon public key`

⚠️ **Nicht** den `service_role` Key verwenden oder teilen.

---

## 2) Datenbank-Schema einrichten

1. Öffne in Supabase den **SQL Editor**.
2. Öffne im Repository die Datei:
   - `supabase/schema.sql`
3. Kopiere den kompletten Inhalt in den SQL Editor und führe ihn aus.

Das Script erstellt:
- Tabelle `public.shopping_items`
- Indexe
- `updated_at`-Trigger
- RLS-Policies (listenbezogen über `x-list-id` Header)
- Realtime-Freigabe für `shopping_items`

---

## 3) Realtime prüfen

1. Öffne in Supabase **Database > Replication**.
2. Prüfe, dass `public.shopping_items` für Realtime aktiv ist.

(Hinweis: Das SQL-Script fügt die Tabelle bereits zur Publication `supabase_realtime` hinzu, falls nötig.)

Die App nutzt **Supabase Realtime als primären Synchronisationsweg** (sofortige Updates bei INSERT/UPDATE/DELETE).
Zusätzlich läuft ein **vorsichtiger Fallback-Abgleich alle 30 Sekunden**, damit Änderungen weiterhin ankommen, falls Realtime auf einzelnen Geräten kurzfristig keine Events liefert.
Der Fallback läuft nur, wenn die Seite sichtbar und online ist, und aktualisiert beim Zurückkehren in den Tab bzw. nach Wiederherstellung der Verbindung sofort.

---

## 4) Frontend konfigurieren

Öffne `app.js` und trage ganz oben im `CONFIG`-Objekt deine Werte ein:

```js
const CONFIG = {
    SUPABASE_URL: "https://DEIN-PROJEKT.supabase.co",
    SUPABASE_ANON_KEY: "DEIN_ANON_PUBLIC_KEY"
};
```

Wenn die Konfiguration fehlt, zeigt die App eine verständliche Fehlermeldung auf der Seite.

---

## 5) Dateien zu GitHub hochladen / committen

Wenn du lokal arbeitest:

1. Änderungen speichern.
2. Commit in dein Repository erstellen.
3. Auf GitHub hochladen.

Die App benötigt keinen zusätzlichen Build- oder Deploy-Schritt außerhalb von GitHub Pages.

---

## 6) GitHub Pages (erneut) deployen

1. Repository öffnen.
2. **Settings > Pages**.
3. Sicherstellen:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Kurz warten, bis die Seite live ist.

---

## 7) Gemeinsame Nutzung testen (2 Browser/Fenster)

1. Öffne die GitHub-Pages-URL in Fenster A.
2. Kopiere den Freigabelink über **„Link kopieren“**.
3. Öffne denselben Link in Fenster B (oder auf einem anderen Gerät).
4. Füge in A einen Artikel hinzu.
5. Prüfe, dass B die Änderung live sieht.
6. Teste auch Abhaken/Bearbeiten/Löschen in beiden Fenstern.

---

## Datenschutz/Sicherheit dieser Prototyp-Version

- Die App ist für einfache private Familiennutzung gedacht.
- Zugriff läuft ausschließlich über den Listenlink.
- **Jede Person mit diesem Link kann die Liste bearbeiten.**
- Teile den Link deshalb nur mit Personen, denen du vertraust.
- Keine sensiblen Daten oder Zugangsdaten in der Liste speichern.

---

## Projektstruktur

```text
index.html
styles.css
app.js
supabase/
  schema.sql
  README.md
```
