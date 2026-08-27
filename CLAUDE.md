@AGENTS.md

# Sensei App

Unterrichtsplanungs-Tool für Berufsschullehrpersonen (Schweiz). UI-Sprache ist Deutsch.

## Tech-Stack

- **Next.js 16** (App Router, Turbopack, Server Actions)
- **React 19** + TypeScript
- **shadcn/ui v4** (basiert auf `@base-ui/react`, NICHT auf Radix)
- **Tailwind CSS v4**
- **Drizzle ORM** + eigene **PostgreSQL 17** (Docker auf Netcup VPS)
- **lucide-react** für Icons
- **unpdf** für PDF-Textextraktion
- **KI**: Ollama Cloud API (OpenAI-kompatibel)

## shadcn/ui v4 — wichtige Unterschiede

Diese Version nutzt `@base-ui/react` statt Radix. Häufige Fehlerquellen:

- **`render` statt `asChild`**: Composition erfolgt über die `render` Prop.
  ```tsx
  // ✅ Richtig
  <Button render={<Link href="/foo" />}>Text</Button>
  <DialogTrigger render={<Button variant="outline" />}>Text</DialogTrigger>
  
  // ❌ Falsch — asChild existiert nicht
  <Button asChild><Link href="/foo">Text</Link></Button>
  ```
- **Accordion hat kein `type` Prop** — unterstützt mehrere offene Items standardmässig.
  ```tsx
  // ✅ Richtig
  <Accordion defaultValue={["item-1", "item-2"]}>
  
  // ❌ Falsch
  <Accordion type="multiple" defaultValue={[...]}>
  ```
- **Select mit leeren Werten**: Leere Strings `""` als `value` vermeiden. Stattdessen Sentinel-Werte verwenden (z.B. `"keine"`, `"frei"`) und in Server Actions abfangen.
- **Select Label-Auflösung**: `SelectValue` kann Labels nur auflösen, wenn `Select.Root` eine `items`-Prop erhält. Ohne `items` zeigt `SelectValue` den rohen `value` an (z.B. UUIDs). Immer `items` als `Record<string, string>` mitgeben:
  ```tsx
  // ✅ Richtig — items-Prop für Label-Auflösung
  <Select items={{ uuid1: "Label 1", uuid2: "Label 2" }}>
    <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
    ...
  </Select>
  
  // Für dynamische Listen:
  <Select items={Object.fromEntries(list.map(x => [x.id, x.name]))}>
  
  // ❌ Falsch — ohne items zeigt SelectValue den rohen value (UUID)
  <Select>
    <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
    ...
  </Select>
  ```

## Server Actions — wichtige Patterns

- **Form Actions statt onClick**: Server Actions aus `onClick`-Handlern lösen kein zuverlässiges `revalidatePath` aus. Stattdessen Form Actions verwenden (`<form action={...}>`), die automatisch `startTransition` nutzen.
  ```tsx
  // ✅ Richtig — Form Action
  <form action={async () => { await serverAction(); }}>
    <Button type="submit">Aktion</Button>
  </form>
  
  // ❌ Unzuverlässig — onClick mit Server Action
  <Button onClick={async () => { await serverAction(); }}>Aktion</Button>
  ```
- **`"use server"`-Dateien dürfen nur `async function` exportieren.** Ein `export const FOO = {...}` bricht erst beim `npm run build`, nicht beim Type-Check. Konstanten entweder nicht exportieren oder in eine eigene Datei auslagern. `export type` ist erlaubt (wird wegkompiliert).

## Datenbank

- **Eigene PostgreSQL 17** im Docker-Compose auf dem Netcup-VPS (kein Supabase mehr)
- Connection-String in `.env.local` als `DATABASE_URL`
- Schema: `src/db/schema.ts` (19 Tabellen)
- Seed-Daten: `src/db/seed.ts` (Bildungsplan EDB + Phasenmodelle AVIVA/PADUA)

### ⚠️ Lokale Entwicklung schreibt in die Produktions-DB

`.env.local` zeigt auf `127.0.0.1:5432` — das ist ein **SSH-Tunnel auf die
Produktionsdatenbank**. Es gibt keine separate lokale DB. Jeder lokale Test
verändert echte Daten. Testdaten deshalb nach dem Testen wieder entfernen.

```bash
# Tunnel öffnen (Port 5432 ist im Heim-WLAN direkt blockiert)
ssh -i ~/.ssh/id_ed25519_menuplan -L 5432:localhost:5432 -N -f root@159.195.241.246
# Tunnel beenden
kill $(lsof -ti:5432)
```

### Migrationen

`npx drizzle-kit push` **funktioniert hier nicht** — es verlangt bei bestehenden
Tabellen einen interaktiven TTY-Prompt und bricht sonst ab. Stattdessen ein
idempotentes Migrations-Script nach dem Muster von `src/db/migrate-*.ts`
schreiben (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) und mit
`npx tsx` ausführen. `dotenv.config({ path: ".env.local" })` muss vor dem
DB-Zugriff laufen.

## KI-Integration

Alle KI-Features laufen über `src/lib/ai.ts`:

- `callAI(prompt, temperature)` → Ollama Cloud (`OLLAMA_API_KEY`, `OLLAMA_MODEL`)
- `parseJsonFromAI<T>(raw)` → robustes JSON-Parsing (Markdown-Fences, Fliesstext drumherum)

**Regel: erst deterministisch parsen, KI nur als Fallback.** Beispiel
Modulplan-Import: JSON direkt → Smartlearn-Parser → erst dann KI.

Bestehende KI-Funktionen:

| Funktion | Datei | Zweck |
|---|---|---|
| `generateWithAI` | `sequenzen/actions.ts` | ganze Sequenz als Lektionsblöcke |
| `generateBaustein` | `sequenzen/actions.ts` | Einstieg / Repetition als **Anker** |
| `suggestUebergabenotiz` | `sequenzen/actions.ts` | Entwurf der Übergabenotiz |
| `extractMaterialTasks` | `materialien/actions.ts` | Schüler-Aufgaben aus Material |
| `importModularPlan` | `sequenzen/actions.ts` | Modulplan aus Freitext/PDF |

## Cockpit-Architektur

Die Sequenz-Detailseite hat zwei Ansichten, umgeschaltet über den Query-Parameter
`?ansicht=cockpit` (bewusst kein Client-State, damit die Seite Server Component
bleibt). Hintergrund und Anforderungen: `redesign.md`.

- **Planung** — Lektionsblöcke mit Phasen, detaillierte Dokumentation
- **Cockpit** — Orientierung während des Unterrichts: Anker-Liste, aus Materialien
  extrahierte Aufgaben, freie Notizen

Darüber liegt in beiden Ansichten der **ContextHeader**: KW, Wochenziel aus dem
Modulplan, anstehende Beurteilungen, Übergabenotiz der Vorsequenz, offene
Pendenzen der Klasse. Die Aggregation macht `src/lib/kontext.ts`.

**Anker statt Phasen**: KI-generierte Einstiege und Repetitionsblöcke landen als
kompakte Einträge in `sequenz_anker`, nicht als Phasentabelle — die Lehrperson
soll sie im Unterricht in Sekunden überfliegen können.

## Stundenplan-Import (.ics)

Sequenzen werden nicht mehr von Hand angelegt, sondern aus dem
WebUntis-Kalenderexport erzeugt (`/stundenplan`, Parser `src/lib/ics.ts`).
Eine Sequenz ist **Klasse × Modul × Unterrichtstag**. Details und Begründung:
`erstellungsprozess.md`.

- Aus `SUMMARY` kommen Klassenkürzel, Modulnummer (die Klammer am Ende ist der
  zuverlässige Anker) und Modulbezeichnung, aus `LOCATION` der Raum.
- **Pausen zerschneiden Blöcke** in mehrere `VEVENT`s. Merge-Regel: gleicher
  UID-Präfix + gleicher Tag + Lücke ≤ 20 min.
- **Lektionenzahl = Anzahl UID-Segmente** nach dem Präfix (1 Segment = 45 min,
  über den Beispielexport ohne Abweichung verifiziert). Nicht aus der Dauer
  schätzen — Pausen verfälschen das.
- Der Kalender nennt Klassen anders als das Team (`BM1WEDB24z; EDB24z` ist
  *eine* Gruppe, intern `MEDB24A`). Die Zuordnung steht in `klasse_alias` und
  wird beim Import einmal gesetzt.
- Idempotent über `(kalender_kurs, start_datum)` — im Export eindeutig.
  Erneuter Import ändert nichts, ein aktualisierter Export korrigiert Zeiten
  und Räume. Sequenzen, die im Export fehlen, werden **gemeldet, nicht
  gelöscht** — dort könnte Planung drinstecken.
- `sequenz.semesterId` ist dadurch **nullable** geworden; der Semesterbegriff
  fällt weg.

## Entwurfsgenerator

Der **Ablauf** (`sequenz_ablauf`) ist das Arbeitsergebnis: 6–10 Schritte, die im
Unterricht zählen. Erzeugt von `erzeugeEntwurf()` in
`src/app/sequenzen/entwurf-actions.ts`.

**Die Arbeitsteilung ist der Kern:**

- **Fakten** (`quelle: "fakt"`) — Aufgabennummern, LA-Codes, Slidebereiche —
  werden serverseitig aus `getWochenstoff()` gesetzt. Die KI bekommt sie nur als
  nummerierte Liste und darf sie ausschliesslich per `{"typ":"fakt","faktId":…}`
  referenzieren. Deshalb kann sie keine Aufgabennummer erfinden und keine
  umformulieren. Fakten, die die KI übergeht, werden hinten angehängt — sonst
  fehlte im Unterricht eine Aufgabe, die eigentlich ansteht.
- **Vorschläge** (`quelle: "vorschlag"`) — Vorwissensaktivierung, Praxisbezug,
  Dramaturgie — stammen von der KI und sind in der Oberfläche markiert.

Bereits erledigte Aufgaben (aus dem Übertrag der Vorwoche) fallen aus der
Faktenliste heraus. Phasenmodelle (AVIVA/PADUA) fliessen als Prompt-Kontext ein
und erscheinen nie als Tabelle.

Ohne Modulplan-Eintrag für die KW bricht die Erzeugung mit klarer Meldung ab —
ohne ihn ist nicht bestimmbar, welcher Block ansteht.

### Schleifen

Der Ablauf wird per **Direktmanipulation** bearbeitet, nicht per KI-Ping-Pong:
umordnen, Texte an Ort und Stelle ändern, Schritte löschen und ergänzen
(`erstellungsprozess.md`, Abschnitt 6.2).

Das Umordnen läuft über **Pointer-Events**, nicht über HTML5-Drag-and-Drop:
letzteres reagiert nicht auf synthetische Mausereignisse (also nicht
testbar) und ist auf Trackpad und Touch unzuverlässig.

Texte sichern beim Verlassen des Felds (`onBlur`), nicht bei jedem Tastendruck.
Fakten aus dem Material behalten ihre Referenz auf LA-Code und Material auch
nach dem Umschreiben.

### Wiederverwendung über Klassen

Dasselbe Modul läuft mit mehreren Klassen — freitags zweimal 168 und zweimal
219, dienstags zweimal 278. Von sieben Sequenzen pro Woche sind vier Dubletten.

- **Klammer ist die Kalenderwoche, nicht der Tag**: der Modulplan ist
  wochenweise organisiert, und zwei Klassen können denselben Stoff an
  verschiedenen Tagen haben. `getGeschwister()` liefert die Parallelsequenzen.
- `uebernehmeAblauf()` kopiert den Ablauf und setzt `sequenz.uebernommenVon`.
  Das Ziel landet auf **Entwurf**, nicht auf bestätigt — durchsehen soll man
  jede Klasse einzeln.
- **Fortschritt und Notizen bleiben pro Klasse getrennt.** Genau daran wird
  sichtbar, wenn die Klassen auseinanderlaufen.
- Der **Nachtlauf gruppiert nach Modul + KW** und plant einmal pro Gruppe.
  Trägt eine Parallelklasse bereits einen Ablauf, wird der übernommen statt
  ein zweiter erzeugt.

### Nachtlauf

`POST /api/entwuerfe/nacht` mit `Authorization: Bearer $CRON_SECRET`, Fenster
sind die nächsten 10 Tage (Do, Fr, folgender Di). Angestossen vom Cron des VPS
über `scripts/nachtlauf.sh` — bewusst kein Timer im App-Prozess, so überlebt der
Lauf jeden Neustart und ist von aussen prüfbar. `CRON_SECRET` steht in
`.env.production` auf dem Server; fehlt es, antwortet die Route mit 503.

Zusätzlich gibt es auf `/stundenplan` einen Knopf für den manuellen Anstoss.

## Übertrag

Nach der Lektion die einzige verbleibende Eingabe: **bis wo sind wir gekommen**.
Nicht ableitbar — die App kann nichts wissen, was nicht getippt wird
(`erstellungsprozess.md`, Abschnitt 6.4).

- Felder auf `sequenz`: `uebertrag`, `uebertragErledigt` (Original-Bezeichnungen
  der abgehakten Aufgaben), `uebertragSlideBis`, `keinUebertrag`, `uebertragAm`.
- Die Häkchen kommen aus `getWochenstoff()` — angeklickt statt getippt.
- **Roter Punkt**: vergangene Sequenzen ohne Übertrag zählt
  `getOffeneUebertraege()`; die Zahl steht als Badge am Stundenplan in der
  Sidebar und als Banner auf `/stundenplan`. Deshalb ist `app/layout.tsx`
  `force-dynamic` — sonst käme der Zählerstand aus der Build-Zeit.
- Die Folgesequenz derselben Klasse im selben Modul zeigt den Übertrag als
  «Stand aus der letzten Lektion» — die Antwort auf «wo fange ich an».

## Smartlearn-Import

Die Lernumgebung Smartlearn exportiert Module als HTML (Beispiel:
`assets/exam_ple/`). `src/lib/smartlearn.ts` liest daraus **ohne KI**:

- den Modularbeitsplan als Tabelle `Datum | Block & Lern- und Arbeitsauftrag | Bemerkung`
- Zeilen beginnen mit `KW nn` oder `FERIEN` und können mehrzeilig sein
- `LB:`-Zeilen sind Leistungsbeurteilungen → `modular_plan.lbHinweis`

### ⚠️ Jedes Modul exportiert anders

Der Export ist **nicht einheitlich**. Belegt an vier Modulen:

| Modul | Arbeitsplan-Tabelle | Block-Überschrift | KW-Format | LB-Marker |
|---|---|---|---|---|
| 119 | `Datum ǀ Block & Lern- und Arbeitsauftrag ǀ Bemerkung` | `Block 01 - Einführung` | `KW 33` | `LB:` |
| 168 | `KW ǀ Block Lern- und Arbeitsauftrag ǀ Bemerkung` | `A - Reifegrade beurteilen` | `KW33` | `Checkpoint 01:` |
| 219 | **keine** — nur als Bild im Export | `Block 1: Vorkenntnisse …` | — | — |
| 278 | `KW ǀ HZ ǀ Block ǀ Thema ǀ Unterrichtsmaterial` | `Block 1: Analysiert …` | `33/34` | `LB-2:` |

Konsequenzen im Code:

- **Blockschlüssel sind Strings**, nicht Zahlen (`modul_block.schluessel`,
  `modular_plan.bloecke` als `text[]`): «01», «1» und «A» kommen alle vor.
  `normalisiereBlock()` vereinheitlicht fürs Vergleichen.
- **`parseModularbeitsplanHtml()` liest die HTML-Tabelle**, nicht den
  geglätteten Text: Spalten werden über die Kopfzeile zugeordnet. Der alte
  Textparser bleibt als Fallback. Eine Zeile kann mehrere KWs betreffen
  (`33/34` → zwei Einträge).
- Manche Module **nummerieren ihre Aufgaben nicht** (dort heissen alle «Neue
  Aufgabe»). Dann ist der LA selbst die Einheit — `sammleFakten()` gibt in dem
  Fall den LA-Code als Fakt aus.
- **Plan und Baum sind unabhängig.** Modul 219 hat einen vollständigen
  Aufgabenbaum, aber keinen maschinenlesbaren Arbeitsplan; sein Plan liegt
  von Hand in `src/db/seed-modulplan-219.ts` (aus der Bild-Grafik übertragen).
  Ein fehlgeschlagener Plan-Import löscht nichts — `importModularPlan` bricht
  vor dem Delete ab.

Bevor ein neues Modul importiert wird: **erst den Export anschauen**, nicht
annehmen, er sehe aus wie die bisherigen.

### Modulbaum

`parseSmartlearnStruktur(html)` liest aus dem **rohen HTML** (nicht aus dem
geglätteten Text) den Aufgabenbaum — dort trägt die Überschriftenebene die
Bedeutung:

```
h2  Block 01 – Einführung
h3  LA_119_1000_Kommunikationstechniken
h5  Ausgangslage / Aufgabenstellung / Gütekriterien
h4  Aufgabe 1
h6  Teilaufgabe 1
```

Er landet in `modul_block` → `modul_auftrag` → `modul_aufgabe`
(Teilaufgaben über `parent_id`). Der Modularbeitsplan liefert zusätzlich
`modular_plan.bloecke` und `.laCodes`, womit die Kette
**KW + Modul ⇒ Block ⇒ LA ⇒ Aufgaben** rein gerechnet wird — `getWochenstoff()`
in `src/lib/modulbaum.ts`. Keine KI im Spiel.

Blöcke werden beim Reimport über `(modulId, nummer)` aktualisiert, nicht neu
angelegt — sonst ginge die gepflegte Slidezuordnung verloren.

**Material hängt am Modul**, nicht an der Sequenz, und trägt ein Etikett
(`material.blockNummer`): `null` = ganzes Modul, sonst genau ein Block. Gilt
eine Präsentation fürs ganze Modul, steht der Slidebereich am Block
(`modul_block.slideVon/slideBis`). Präsentationen als **PDF** — Seite = Slide,
Deep-Link `#page=N`; für `.pptx` fehlt weiterhin ein OOXML-Parser.

Bei der Aufgaben-Extraktion aus Materialien werden die **Original-Bezeichnungen
beibehalten** («Aufgabe 1 / Teilaufgabe 2», LA-Codes). Nicht umformulieren — die
Lehrperson muss der Klasse «macht Aufgabe 4.2» sagen können.

## Befehle

```bash
npm run dev                       # Dev-Server starten (Port 3000)
npx tsx src/db/migrate-<name>.ts  # Migration ausführen (NICHT drizzle-kit push)
npx tsx src/db/seed.ts            # Seed-Daten laden
npx tsc --noEmit                  # Type-Check
npm run build                     # Build (fängt "use server"-Fehler, die tsc nicht sieht)
```

## Deployment

Netcup VPS, Docker Compose (App + PostgreSQL), Nginx + Let's Encrypt,
https://sensei.maelu.fun

```bash
ssh -i ~/.ssh/id_ed25519_menuplan root@159.195.241.246 \
  'cd /opt/sensei-app && git pull && docker compose up -d --build'
```

**`git pull` allein deployt nichts** — ohne `docker compose up -d --build` läuft
weiter das alte Image. Nach dem Deploy verifizieren, z.B. per
`curl -s https://sensei.maelu.fun/... | grep <neuer Text>`.

Schema-Änderungen sind durch den SSH-Tunnel meist schon in der Produktions-DB,
bevor deployt wird — das Migrations-Script muss dort nicht nochmals laufen.

## Projektstruktur

```
src/
├── app/
│   ├── page.tsx                  # Dashboard
│   ├── api/
│   │   ├── upload/               # Datei-Upload für Modul-Material
│   │   ├── files/[...path]/      # Ausliefern hochgeladener Dateien
│   │   └── modulplan/import/     # Modulplan-Import aus Datei (PDF/HTML/JSON)
│   ├── semester/                 # Semester CRUD + Kalenderansicht
│   ├── klassen/                  # Klassen CRUD + Pendenzen-Actions
│   ├── sequenzen/                # Sequenzen CRUD
│   │   └── [id]/                 # Detailseite: Planung + Cockpit
│   │       ├── context-header.tsx
│   │       ├── cockpit-view.tsx
│   │       ├── ansicht-toggle.tsx
│   │       └── lektionsbloecke-section.tsx
│   ├── bildungsplan/             # HKB/HK-Übersicht, Coverage-Matrix, Modulplan
│   └── materialien/              # Material-Übersicht + KI-Task-Extraktion
├── components/
│   ├── ui/                       # shadcn/ui Komponenten
│   ├── app-sidebar.tsx           # Navigation
│   └── material-section.tsx      # Wiederverwendbare Material-Komponente
├── lib/
│   ├── ai.ts                     # Ollama-Aufruf + JSON-Parsing
│   ├── kontext.ts                # Kontext-Aggregation für den ContextHeader
│   ├── kw.ts                     # ISO-Kalenderwochen
│   ├── smartlearn.ts             # Parser für Smartlearn-HTML-Exporte
│   ├── dokument-text.ts          # Text aus PDF/HTML/TXT
│   └── material-link.ts          # Deep-Links ins Material (#page=N)
└── db/
    ├── index.ts                  # DB-Verbindung (postgres-js + Drizzle)
    ├── schema.ts                 # Drizzle Schema
    ├── seed.ts                   # Bildungsplan EDB + AVIVA/PADUA
    └── migrate-*.ts              # Idempotente Migrations-Scripts
```

## Patterns

- **Server Actions** für alle CRUD-Operationen (`"use server"` in `actions.ts` Dateien)
- **Server Components** für Seiten, **Client Components** für interaktive Teile (`"use client"`)
- **FormData** basierte Actions mit `revalidatePath` + `redirect`
- Alle Tabellen nutzen **UUID** Primary Keys mit `defaultRandom()`
- Cascading Deletes auf Foreign Keys
- KI-Ergebnisse sind **Entwürfe**: anzeigen, prüfen lassen, erst auf bewusste
  Aktion speichern (siehe Übergabenotiz-Vorschlag)

## Bekannte Altlasten

- `Button render={<Link/>}` erzeugt in der Dev-Overlay-Konsole eine Base-UI-Warnung
  (`nativeButton`). Kosmetisch, betrifft mehrere Seiten.
- Aus `.pptx`/`.docx` kann kein Text gelesen werden — es fehlt ein OOXML-Parser.
  `extractMaterialTasks` gibt dafür eine klare Fehlermeldung aus.
- Mehrere `actions.ts` haben ungenutzte Imports (Lint-Warnungen, vorbestehend).
