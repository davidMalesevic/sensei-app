# Sensei

Unterrichtsplanung für Berufsfachschullehrpersonen. Läuft unter
[sensei.maelu.fun](https://sensei.maelu.fun).

**Der tragende Gedanke:** Eine Unterrichtssequenz ist *Klasse × Modul ×
Unterrichtstag* und entsteht **aus dem Stundenplan**, nicht aus einem Formular.
Alles, was aus einer Datei gelesen werden kann — Kalender, Modulplan,
Aufgabenbaum —, wird gelesen. Die KI ordnet und formuliert nur das, was
wirklich Erfindung ist.

Die Anforderungen und ihre Begründungen stehen in
[`erstellungsprozess.md`](erstellungsprozess.md), die Arbeitsanleitung für
Entwicklung in [`CLAUDE.md`](CLAUDE.md).

---

## Was die App macht

### Der Mittwoch-Durchgang

Sensei ist um eine wiederkehrende Stunde herum gebaut: die Vorbereitung der
kommenden Unterrichtswoche. Die Sequenzseite folgt genau dieser Reihenfolge —
eine Ansicht, keine Umschaltung zwischen Planung und Durchführung.

1. **Kontext** — Kalenderwoche, Wochenziel aus dem Modulplan, anstehende
   Leistungsbeurteilungen, offene Pendenzen der Klasse
2. **Stand** — wo die letzte Lektion derselben Klasse im selben Modul endete
3. **Ablauf** — 6–10 Schritte, das eigentliche Arbeitsergebnis, direkt
   bearbeitbar
4. **Parallelklassen** — dieselbe Woche in anderen Klassen, mit einem Klick
   übernehmbar
5. **Stoff dieser Woche** — die Fakten dahinter, als Referenz
6. **Übertrag** — die einzige Eingabe nach der Lektion
7. **Notizen** — freier Text

### Stundenplan statt Formular

Der WebUntis-Kalenderexport (`.ics`) erzeugt die Sequenzen samt Klasse, Modul,
Datum, Zeit, Lektionenzahl und Raum. Pausen zerschneiden Blöcke in mehrere
Termine — die werden wieder zusammengesetzt; die Lektionenzahl kommt aus der
Zahl der UID-Segmente, nicht aus der Dauer.

Der Import ist **idempotent**: dieselbe Datei erneut einlesen ändert nichts,
ein aktualisierter Export korrigiert Zeiten und Räume. Sequenzen, die im Export
fehlen, werden **gemeldet, nicht gelöscht** — dort könnte Planung drinstecken.

### Entwurfsgenerator

Der Ablauf entsteht aus einer klaren Arbeitsteilung:

- **Fakten** (Aufgabennummern, LA-Codes, Slidebereiche) werden serverseitig aus
  dem Modulbaum gesetzt. Die KI bekommt sie nur als nummerierte Liste und darf
  sie ausschliesslich referenzieren — sie kann deshalb keine Aufgabennummer
  erfinden und keine umformulieren.
- **Vorschläge** (Vorwissensaktivierung, Praxisbezug, Dramaturgie) kommen von
  der KI und sind in der Oberfläche als solche markiert.

Bearbeitet wird per Direktmanipulation: umordnen, Texte an Ort und Stelle
ändern, Schritte löschen und ergänzen. Kein Ping-Pong mit der KI.

Von sieben Sequenzen pro Woche sind typischerweise vier Dubletten — dasselbe
Modul in Parallelklassen. Einmal planen, dann übernehmen; Fortschritt und
Notizen bleiben pro Klasse getrennt, damit sichtbar wird, wenn die Klassen
auseinanderlaufen.

### Vorbereitungsdurchgang

Ein Cron auf dem Server erzeugt die Entwürfe im Voraus. **Wann das geschieht,
stellt jede Person selbst ein** (`/mein-konto`): Wochentag oder täglich,
Uhrzeit, Vorlauf in Tagen. Die Mittwochnacht war nie mehr als eine Gewohnheit.

### Smartlearn-Import

Die Lernumgebung exportiert Module als HTML. Sensei liest daraus **ohne KI**
den Modularbeitsplan und den Aufgabenbaum (Block → Lern- und Arbeitsauftrag →
Aufgabe). Damit lässt sich die Kette **KW + Modul ⇒ Block ⇒ LA ⇒ Aufgaben**
rein rechnen.

Achtung: jedes Modul exportiert anders. Vier belegte Varianten und ihre
Konsequenzen stehen in [`CLAUDE.md`](CLAUDE.md).

### Konten

Zugang nur auf Einladung — es gibt keine offene Registrierung. Ein Admin
erzeugt in `/verwaltung` einen Einmal-Link pro Person (7 Tage gültig,
rücknehmbar). **Jedes Konto sieht nur seine eigenen Daten**; geteilt bleibt der
offizielle EDB-Bildungsplan.

Passwörter werden nie im Klartext weitergereicht: ein Admin erzeugt einen
Einmal-Link, die betroffene Person setzt ihr Passwort selbst.

---

## Technik

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, Server Actions) |
| Sprache | TypeScript, React 19 |
| Oberfläche | IBM Carbon Design System als Token-Schicht über Tailwind v4 und shadcn/ui v4 (`@base-ui/react`) |
| Datenbank | PostgreSQL 17 mit Drizzle ORM |
| KI | Ollama Cloud (OpenAI-kompatibel) |
| Betrieb | Docker Compose auf einem Netcup-VPS, Nginx, Let's Encrypt |

Die Oberfläche folgt Carbon, benutzt aber **nicht** `@carbon/react`: diese
Bibliothek bringt Sass und fast nur Client-Komponenten mit und stünde neben
Tailwind als zweites System. Stattdessen liegen Carbons Tokens, Typoskala und
Komponentenspezifikationen in `globals.css` und `components/ui/`.

**Leitsätze, die sich durch den Code ziehen:**

- Erst deterministisch parsen, KI nur als Fallback
- Die KI ordnet und formuliert, sie erfindet keine Fakten
- KI-Ergebnisse sind Entwürfe: anzeigen, prüfen lassen, bewusst bestätigen
- Idempotente Importe; nie löschen, was Arbeit enthalten könnte

---

## Entwicklung

```bash
npm install
npm run dev          # http://localhost:3000
```

Nötig ist eine `.env.local` mit mindestens:

```
DATABASE_URL=postgres://…
OLLAMA_API_KEY=…
OLLAMA_MODEL=…
```

### ⚠️ Die lokale Entwicklung schreibt in die Produktionsdatenbank

`.env.local` zeigt auf einen SSH-Tunnel zur Produktions-DB. Eine separate
lokale Datenbank gibt es nicht. **Jeder lokale Test verändert echte Daten** —
Testdaten danach wieder entfernen.

```bash
ssh -i ~/.ssh/id_ed25519_menuplan -L 5432:localhost:5432 -N -f root@…
kill $(lsof -ti:5432)
```

### Prüfen

```bash
npx tsc --noEmit     # Typen
npx eslint src       # Lint
npm run build        # fängt "use server"-Fehler, die tsc nicht sieht
```

### Migrationen

`npx drizzle-kit push` funktioniert hier **nicht** — es verlangt bei
bestehenden Tabellen einen interaktiven Prompt. Stattdessen idempotente
Scripts nach dem Muster von `src/db/migrate-*.ts` schreiben und mit `npx tsx`
ausführen.

---

## Deployment

```bash
ssh -i ~/.ssh/id_ed25519_menuplan root@… \
  'cd /opt/sensei-app && git pull && docker compose up -d --build'
```

**`git pull` allein deployt nichts** — ohne `--build` läuft weiter das alte
Image. Nach dem Deploy verifizieren, etwa per `curl … | grep <neuer Text>`.

Der Container läuft auf **UTC**, die Schule auf **Europe/Zurich**. Alle
Datums- und Zeitrechnungen laufen deshalb über `src/lib/zeit.ts` — nie über
`new Date().toISOString()`.

---

## Lizenz

Privates Projekt, kein Support.
