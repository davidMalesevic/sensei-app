@AGENTS.md

# Sensei App

Unterrichtsplanungs-Tool für Berufsschullehrpersonen (Schweiz). UI-Sprache ist Deutsch.

**Der tragende Gedanke:** Eine Sequenz ist *Klasse × Modul × Unterrichtstag* und
entsteht **aus dem Stundenplan**, nicht aus einem Formular. Alles, was aus einer
Datei gelesen werden kann — Kalender, Modulplan, Aufgabenbaum — wird gelesen;
die KI ordnet und formuliert nur das, was wirklich Erfindung ist.
Anforderungen und Begründungen stehen in `erstellungsprozess.md`.

## Tech-Stack

- **Next.js 16** (App Router, Turbopack, Server Actions)
- **React 19** + TypeScript
- **shadcn/ui v4** (basiert auf `@base-ui/react`, NICHT auf Radix)
- **Tailwind CSS v4**
- **IBM Carbon Design System** — als Token-Schicht in `globals.css`, nicht als
  `@carbon/react`. Siehe *Carbon*.
- **Drizzle ORM** + eigene **PostgreSQL 17** (Docker auf Netcup VPS)
- **@carbon/icons-react** für Icons (`<Icon size={16} />`, nicht `className="h-4 w-4"`)
- **IBM Plex Sans / IBM Plex Mono** über `next/font/google`
- **unpdf** für PDF-Textextraktion
- **KI**: Ollama Cloud API (OpenAI-kompatibel)
- **Anmeldung**: eigene Sessions (scrypt + Cookie), Daten pro Benutzer getrennt

## Anmeldung und Datentrennung

Eigenes Login, nach dem Vorbild der Menüplanungs-App: Passwort-Hash in
`benutzer`, zufälliges Token in `session`, httpOnly-Cookie (30 Tage). Kein
fremder Dienst.

**Jedes Konto sieht nur seine eigenen Daten.** Klassen, Sequenzen, Module,
Material, Pendenzen und Kalenderzuordnungen tragen eine `benutzer_id`. Ein
neues Konto startet leer und importiert seinen eigenen Stundenplan.

Geteilt bleiben **Bildungsplan, HKB, HK und die Phasenmodelle** — der
offizielle EDB-Plan ist niemandes Eigentum. `bildungsplan.benutzer_id IS NULL`
heisst «geteilt»; bei der Registrierung wählt man einen geteilten Plan oder
legt einen eigenen an (`benutzer.bildungsplan_id`).

### Die drei Schichten

| Datei | Rolle |
|---|---|
| `src/proxy.ts` | **In Next 16 heisst `middleware.ts` neu `proxy.ts`.** Prüft nur, *ob* ein Cookie da ist — optimistisch, ohne DB, weil der Proxy bei jedem Request und jedem Prefetch läuft. |
| `src/lib/dal.ts` | Die echte Prüfung. `aktuelleSession()` gibt `null` zurück, `aktuellerBenutzer()` leitet auf `/anmelden` um. Über `cache()` pro Render nur eine Abfrage. |
| `src/lib/auth.ts` | scrypt aus `node:crypto` statt bcrypt — keine native Abhängigkeit, die im Docker-Build bricht. Format `scrypt$<salt>$<hash>`. |

### Regeln

- **Keine Abfrage ohne Besitzer.** Jede Server Action beginnt mit
  `const bId = await benutzerId()`, und jedes `where` enthält
  `eq(<tabelle>.benutzerId, bId)`. Auch beim Schreiben: `eq(id)` allein würde
  eine geratene UUID auf fremde Zeilen treffen lassen.
- **Kindtabellen** (`sequenz_ablauf`, `modul_block`, `modul_auftrag`,
  `modul_aufgabe`, `modular_plan`, `material_task`) tragen keinen eigenen
  Besitzer — sie werden über den Elternteil geprüft. Dafür gibt es in den
  Action-Dateien kleine Helfer wie `eigeneSequenz()`, `eigenesModul()`,
  `eigeneAblaufZeile()`.
- **Route Handler laufen am DAL vorbei.** `/api/upload`, `/api/files`,
  `/api/materialien/...` und `/api/modulplan/import` prüfen die Session von
  Hand und antworten mit 401 statt mit einer Weiterleitung.
  `/api/files` liefert nur aus, was als eigenes Material in der DB steht —
  vorher genügte die Kenntnis des Pfades.
- **Der Proxy kennt keine Gegenregel «Cookie da → weg von der Anmeldeseite».**
  Er weiss nur, *dass* ein Cookie existiert, nicht ob die Sitzung noch gilt.
  Mit einem abgelaufenen Cookie entstand sonst eine Weiterleitungsschleife:
  `/` schickt zur Anmeldung, der Proxy zurück auf `/`. Das traf jeden, dessen
  Sitzung ablief oder dem ein Admin die Sitzungen beendet hatte. Ob jemand
  bereits angemeldet ist, entscheidet die Anmeldeseite selbst.
- **Anmelden, Einladung und Passwort-Link stehen ohne UI Shell da.** Welcher
  Pfad öffentlich ist, reicht der Proxy dem Root-Layout über einen Header
  (`x-sensei-oeffentlich`) — die Next-Doku nennt Header ausdrücklich als den
  Weg, Information aus dem Proxy in die Anwendung zu geben; ein Layout kennt
  den Pfad sonst nicht.
- **Der Entwurfsgenerator liegt in `src/lib/entwurf.ts`, nicht in einer
  `"use server"`-Datei.** Er nimmt die Benutzer-ID als ersten Parameter, damit
  der Nachtlauf sie ohne Session hereinreichen kann. Läge er in einer
  Action-Datei, könnte jeder Browser ihn mit einer fremden ID aufrufen.
  Gleiches gilt für `src/lib/uebertrag.ts`.
- Der **Nachtlauf** (`/api/entwuerfe/nacht`) läuft jetzt **pro Konto** in einer
  Schleife; ein Fehler in einem Konto reisst die übrigen nicht mit.

### Hereinkommen: nur auf Einladung

Es gibt **keine offene Registrierung** und keinen gemeinsamen Code mehr. Ein
Admin erzeugt in `/verwaltung` einen Einmal-Link pro Person:

| | Gültigkeit | Einmal? | Rücknehmbar |
|---|---|---|---|
| Einladung (`/einladung/<token>`) | 7 Tage | ja | ja |
| Passwort-Link (`/neues-passwort/<token>`) | 24 Stunden | ja | — |

Von beiden steht **nur der SHA-256-Hash** in der Datenbank; der Klartext
existiert einmal, in dem Link, den der Admin weitergibt. Wer die Datenbank
liest, hält damit keinen funktionierenden Link in der Hand. SHA-256 genügt,
weil das Token 32 zufällige Bytes hat — ein langsames Verfahren wie bei
Passwörtern braucht es nur gegen Raten.

Die E-Mail steckt in der Einladung und ist beim Anlegen nicht änderbar; sonst
liesse sich mit einem fremden Link eine beliebige Adresse eintragen. Ein
Passwort-Link beendet zusätzlich alle Sitzungen des Kontos — wer ihn braucht,
hat den Zugang womöglich verloren.

### Verwaltung

`/verwaltung`, nur für `benutzer.ist_admin`. `aktuellerAdmin()` liefert für
alle anderen **404 statt 403**: eine Seite, die man nicht betreten darf, muss
nicht verraten, dass es sie gibt. Jede Server Action prüft dasselbe noch
einmal selbst — Actions sind vom Browser aufrufbar, die Prüfung darf nie nur
in der Seite stehen.

Konten auflisten, einladen, Passwort-Link erzeugen, Sitzungen beenden,
Admin-Rechte vergeben, Konto samt allen Daten löschen (Tippbestätigung der
E-Mail). Der **letzte Admin** kann nicht entfernt werden, und niemand entzieht
sich selbst das Recht oder löscht das eigene Konto.

`migrate-admin.ts` macht das älteste Konto zum Admin, falls es noch keinen
gibt — sonst käme nach der Migration niemand mehr hinein.

### Mein Konto

`/mein-konto`: Name, E-Mail, Passwort ändern (altes zur Bestätigung). Ein
Passwortwechsel meldet **andere** Geräte ab, das eigene bleibt angemeldet.

### Vorbereitungsdurchgang

Früher lief der Nachtlauf fix um 03:00 für alle. Jetzt steht am Konto, wann er
läuft: `vorbereitung_aktiv`, `vorbereitung_tag`, `vorbereitung_stunde`,
`vorbereitung_tage_voraus`. Der Cron ruft **stündlich** auf; die Route filtert,
wer gerade dran ist.

**`vorbereitung_tag` ist der Wochentag, an dem der Lauf stattfindet** (0 =
Sonntag, wie `Date.getDay()`), NULL = jeden Tag. Nicht die Nacht davor: eine
Beschriftung wie «Dienstagnacht auf Mittwoch» wäre um einen Tag verschoben und
würde ausserdem unsinnig, sobald jemand 14 Uhr einstellt. Wer die Nacht auf
Mittwoch meint, wählt Mittwoch und 03:00.

`POST /api/entwuerfe/nacht?alle=1` ignoriert die Zeitpunkte — für den
Handbetrieb.

### Migration

```bash
npx tsx src/db/migrate-benutzer.ts            # Tabellen + nullbare Spalten
# dann ein Konto anlegen (Einladungslink)
npx tsx src/db/besitz-uebertragen.ts <email>  # Bestand zuweisen, NOT NULL setzen
npx tsx src/db/migrate-admin.ts               # Admin-Flag, Einladungen, Zeitplan
```

Die Spalten entstehen bewusst **nullbar** und werden erst auf NOT NULL gezogen,
wenn alle Zeilen einen Eigentümer haben — sonst schlägt die Migration auf einer
Datenbank mit Inhalt fehl. Beide Scripts sind idempotent.

Zwei früher globale Unique-Constraints gelten jetzt **pro Konto**:
`klasse_alias.kuerzel` und `modul.nummer`. Dasselbe Kalenderkürzel und
dieselbe Modulnummer kommen bei mehreren Lehrpersonen vor.

Module werden **nicht mehr geseedet** — sie entstehen beim Stundenplan-Import.
Die Zuordnung Nummer → Lehrjahr steht in `src/lib/modul-lehrjahr.ts`.

## Carbon

Die Oberfläche folgt dem **IBM Carbon Design System** — aber ohne
`@carbon/react`. Diese Bibliothek bringt Sass und ihr eigenes Styling mit und
besteht fast vollständig aus Client-Komponenten; sie stünde neben Tailwind und
base-ui als zweites, konkurrierendes System und würde Server Components
kaputtmachen. Stattdessen liegt Carbon als **Token-Schicht** in
`src/app/globals.css`, und die Primitives in `components/ui/` sind nach
Carbon-Spezifikation gestylt.

**Theme: White (hell) / Gray 100 (dunkel).** Umschalter in der Kopfleiste,
gemerkt in `localStorage["sensei-theme"]`; ein Inline-Script im `<head>` setzt
die Klasse vor dem ersten Paint, damit nichts aufblitzt.

### Tokens

Die shadcn-Namen (`background`, `primary`, `muted`, `border` …) bleiben
bestehen, tragen aber Carbon-Werte. Daneben stehen die Carbon-eigenen Rollen:

| Rolle | hell | Wofür |
|---|---|---|
| `background` | `#ffffff` | die Seite |
| `layer` | `#f4f4f4` | jede abgesetzte Fläche: Kachel, Tabelle, Liste |
| `layer-hover` / `layer-selected` | `#e8e8e8` / `#e0e0e0` | Hover, Auswahl |
| `field` | `#f4f4f4` | Eingabefelder |
| `border-subtle` / `border-strong` | `#e0e0e0` / `#8d8d8d` | Trennlinie / Feldlinie |
| `border-interactive` | `#0f62fe` | der 3px-Balken links an Ausgewähltem |
| `text-secondary` / `text-helper` | `#525252` / `#6f6f6f` | Fliesstext / Hilfetext |
| `support-error/success/warning/info` | — | nur Status, nie Dekoration |

**Blau ist Interaktion, Rot ist Gefahr.** Deshalb sticht der Zähler für offene
Überträge wieder heraus.

### Regeln, die man leicht bricht

- **Kein Radius, kein Schatten.** `--radius-*` ist überall `0`. Flächen werden
  über Helligkeit getrennt, nicht über Tiefe. Einzige Ausnahme: der Carbon-Tag
  (`Badge`) ist eine Pille, und Popups werfen einen harten Schatten.
- **Fokus ist ein 2px-Rahmen nach innen** (`outline-offset: -2px`), kein
  weicher Ring. Eine Basisregel in `globals.css` setzt das global.
- **Typografie über die Type-Scale-Utilities**, nicht über `text-sm`.
  Carbon hat zwei Reihen; diese App benutzt durchgehend die **grössere «02»**:

  | Utility | Grösse | Wofür |
  |---|---|---|
  | `type-heading-05/04/03` | 32 / 28 / 20 px | Seitentitel, Abschnitte |
  | `type-heading-02` / `type-heading-compact-02` | 16 px, 600 | Zeilentitel, Tabellenköpfe |
  | `type-body-02` / `type-body-compact-02` | **16 px** | Lauftext, Bedienelemente |
  | `type-label-02` / `type-helper-02` | 14 px | Feldbeschriftung, Hilfetext |

  Die dichte «01»-Reihe (14/12px) steht weiterhin bereit, wird aber nur für
  Ausnahmen benutzt (`Button size="xs"`). Grösse trägt die Hierarchie, nicht
  Fettdruck — `h1` ist 32px in Normalstärke.
- **Bedienelemente sind auf 16px-Text gepaart**: Felder, Selects und Knöpfe
  48px (`sm` 40px), Tabellenzeilen 48px, SideNav-Einträge 40px. Wer `h-8`
  von Hand setzt, klemmt den Text ein.
- **Buttons sind linksbündig** mit dem Icon rechts aussen; das ist Carbons
  Signatur, kein Fehler. Für dichte Tabellenzeilen gibt es
  `size="icon-sm" variant="ghost-neutral"`, nicht schmalere Textknöpfe.
- **Abstände aus Carbons Skala**: 2, 4, 8, 12, 16, 24, 32, 40, 48, 64 px —
  in Tailwind `0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16`.
- **Zusammengehörige Kacheln** stehen in einem `grid gap-px bg-border-subtle`,
  damit sie sich als ein Paneel lesen und nicht als lose Karten.

### Komponenten

`components/ui/` bildet Carbon nach. Die Zuordnung der Variantennamen:

| Datei | Carbon | Hinweis |
|---|---|---|
| `button.tsx` | Button | `default`=Primary, `secondary`, `outline`=Tertiary, `ghost`, `ghost-neutral`, `destructive`=Danger, `destructive-ghost` |
| `badge.tsx` | Tag | Farbnamen (`blue`, `green`, `red`, `purple`, `cool-gray` …) |
| `card.tsx` | Tile | `CardClickable` für anklickbare Kacheln |
| `table.tsx` | Data Table | Kopf auf `layer-accent`, Zeilen auf `layer` |
| `notification.tsx` | Inline Notification | `kind`: `error`, `success`, `warning`, `info` |
| `loading.tsx` | Loading / Inline Loading | rotierender Ring, 690 ms linear |
| `page-header.tsx` | Page Header, Breadcrumb | dazu `SectionHeader` und `DataItem` |
| `structured-list.tsx` | Structured List | für Listen, die keine Tabelle sind |
| `dialog.tsx` | Modal | Fuss: randlose Knöpfe, 64px hoch, teilen sich die Breite |
| `input` / `textarea` / `select` | Text Input, Text Area, Dropdown | gefüllte Fläche, eine Linie unten |

Neue Icons kommen aus `@carbon/icons-react`. **Vor dem Import prüfen, ob es sie
gibt** — die Namen weichen von lucide ab (`TrashCan` statt `Trash2`,
`Launch` statt `ExternalLink`, `PresentationFile`, `MachineLearningModel`):

```bash
ls node_modules/@carbon/icons-react/lib/ | grep -i <name>
```

### UI Shell

`components/shell/ui-shell.tsx`: schwarze Kopfleiste (48px, `shell`-Tokens,
in beiden Themes dunkel) über einer SideNav (256px). Der aktive Eintrag trägt
einen 3px-Balken links in `border-interactive`.

- Die Breite unterscheidet Desktop von Mobil über `useSyncExternalStore` auf
  eine Media Query — kein `setState` im Effect, sonst schlägt die ESLint-Regel
  `react-hooks/set-state-in-effect` zu.
- Beim Drucken verschwindet die Shell: `print:hidden` an Kopfleiste und
  SideNav plus ein `@media print`-Block in `globals.css`.

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
- Schema: `src/db/schema.ts` (24 Tabellen, davon einige nur noch Archiv —
  siehe *Bekannte Altlasten*)
- Seed-Daten: `src/db/seed.ts` (Bildungsplan EDB + Phasenmodelle AVIVA/PADUA)

### Lokale Entwicklung hängt an der Testdatenbank

`.env.local` zeigt auf `127.0.0.1:5433` — den SSH-Tunnel zur **Testinstanz**,
nicht mehr zur Produktion. Lokale Tests verändern damit nur Testdaten.

```bash
# Testdatenbank (Normalfall)
ssh -i ~/.ssh/id_ed25519_menuplan -L 5433:localhost:5433 -N -f root@159.195.241.246

# Produktionsdatenbank — nur wenn es wirklich sein muss
ssh -i ~/.ssh/id_ed25519_menuplan -L 5432:localhost:5432 -N -f root@159.195.241.246

kill $(lsof -ti:5433)   # bzw. 5432
```

Bis August 2026 zeigte `.env.local` auf die Produktion, und jeder lokale Test
veränderte echte Unterrichtsdaten. Der Port im Connection-String ist der
einzige Unterschied — beim Umstellen also genau hinsehen.

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

**Die KI ordnet und formuliert, sie erfindet keine Fakten.** Aufgabennummern,
LA-Codes und Slidebereiche kommen aus dem Material und werden serverseitig
gesetzt — siehe *Entwurfsgenerator*.

| Funktion | Datei | Zweck |
|---|---|---|
| `erzeugeEntwurf` | `sequenzen/entwurf-actions.ts` | Ablauf aus Fakten + KI-Vorschlägen |
| `erzeugeEntwuerfe` | `sequenzen/entwurf-actions.ts` | Stapellauf, gruppiert nach Modul + KW |
| `extractMaterialTasks` | `materialien/actions.ts` | Schüler-Aufgaben aus Material |
| `importModularPlan` | `bildungsplan/modulplan-actions.ts` | Modulplan, KI nur als letzter Fallback |

## Sequenz-Seite

**Eine Ansicht, keine Umschaltung.** Die frühere Trennung Planung/Cockpit ist
weg: der Ablauf *ist* die Planung und zugleich das, was im Unterricht zählt.

Die Reihenfolge folgt dem Mittwoch-Durchgang:

1. **ContextHeader** — KW, Wochenziel aus dem Modulplan, anstehende
   Beurteilungen, offene Pendenzen der Klasse (`src/lib/kontext.ts`)
2. **Stand** — Übertrag der letzten Lektion derselben Klasse im selben Modul
3. **Ablauf** — das Arbeitsergebnis, bearbeitbar
4. **Geschwister** — dieselbe Woche in anderen Klassen
5. **Stoff dieser Woche** — die Fakten dahinter, als Referenz
6. **Übertrag** — die einzige Eingabe nach der Lektion
7. **Notizen** — freier Text

**Entfernt (Schritt 7 der Umsetzung):** Lektionsblöcke, Phasen, HK-Zuordnung,
`/sequenzen/neu`, das Sequenz-Formular, die Bearbeiten-Seite, die alten
KI-Dialoge und die Semesterverwaltung. Die zugehörigen **Tabellen bleiben
bestehen** (`lektionsblock`, `phase`, `sequenz_handlungskompetenz`,
`sequenz_anker`, `semester`) — dort hängen die drei Alt-Sequenzen als Archiv.
Sie werden von keinem Code mehr gelesen.

Damit fällt auch die **Coverage-Matrix** im Bildungsplan trocken: ohne
HK-Zuordnung pro Sequenz hat sie keine Datenbasis mehr. Bewusst akzeptiert.

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

### Vorbereitungsdurchgang (früher «Nachtlauf»)

`POST /api/entwuerfe/nacht` mit `Authorization: Bearer $CRON_SECRET`.
Angestossen vom Cron des VPS über `scripts/nachtlauf.sh` — bewusst kein Timer
im App-Prozess, so überlebt der Lauf jeden Neustart und ist von aussen prüfbar.
`CRON_SECRET` steht in `.env.production`; fehlt es, antwortet die Route mit 503.

**Der Cron läuft stündlich** (`0 * * * *`), nicht mehr täglich um 03:00. Wann
jemand drankommt, steht am Konto — siehe *Vorbereitungsdurchgang* im Abschnitt
«Anmeldung und Datentrennung». Die Route schleift über alle Konten, prüft
Wochentag und Stunde in Schweizer Zeit und benutzt den persönlichen Vorlauf.
Ein Fehler in einem Konto reisst die übrigen nicht mit.

`?alle=1` ignoriert die eingestellten Zeitpunkte — für den Handbetrieb.
Zusätzlich gibt es auf `/stundenplan` einen Knopf, der nur das eigene Konto
sofort durchrechnet.

## Zeitzonen

Der Container läuft auf **UTC**, die Schule auf **Europe/Zurich**.
`new Date().toISOString().slice(0, 10)` ist deshalb falsch: zwischen Mitternacht
und 02:00 Schweizer Zeit liefert es den Vortag, und jeder Uhrzeitvergleich liegt
zwei Stunden daneben.

Alles über `src/lib/zeit.ts`:

- `schweizerJetzt()` → `{ datum, zeit }` in Schweizer Zeit
- `schweizerHeute()` ersetzt das UTC-Datum
- `schweizerDatumPlus(tage)` für Zeitfenster
- `findeAktuelle(sequenzen)` → laufende und nächste Sequenz

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
npx tsx src/db/migrate-benutzer.ts     # Login + Datentrennung
npx tsx src/db/besitz-uebertragen.ts <email>  # Bestand einem Konto zuweisen
npx tsx src/db/migrate-admin.ts        # Verwaltung, Einladungen, Zeitplan
npx tsx src/db/seed.ts            # Seed-Daten laden
npx tsc --noEmit                  # Type-Check
npx eslint src                    # Lint
npm run build                     # Build (fängt "use server"-Fehler, die tsc nicht sieht)
```

## Zwei Instanzen: Test und Produktion

| | Produktion | Test |
|---|---|---|
| Adresse | https://sensei.maelu.fun | https://sensei-test.maelu.fun |
| Branch | `main` | `test` |
| Verzeichnis | `/opt/sensei-app` | `/opt/sensei-test` |
| Ports (nur localhost) | App 3000, DB 5432 | App 3001, DB 5433 |
| Vorbereitungsdurchgang | stündlicher Cron | **kein Cron** |

Volumes, Datenbank, Uploads und `CRON_SECRET` sind getrennt; Compose
namensraumt sie über das Projektverzeichnis (`sensei-app_*` vs `sensei-test_*`).
Die Host-Ports kommen aus einer `.env` im jeweiligen Projektverzeichnis
(`APP_PORT`, `DB_PORT`) — ohne Werte gelten 3000/5432.

### Arbeitsweise

**Nie direkt auf `main` committen.** Gearbeitet wird auf `test`; damit ist
`main` immer ein Vorfahre und das Freigeben ein Fast-Forward:

```bash
# 1. Auf test arbeiten und dorthin deployen
git push origin test
ssh -i ~/.ssh/id_ed25519_menuplan root@159.195.241.246 \
  'cd /opt/sensei-test && git pull && docker compose up -d --build'

# 2. Nach dem Prüfen freigeben
git checkout main && git merge --ff-only test && git push origin main
ssh -i ~/.ssh/id_ed25519_menuplan root@159.195.241.246 \
  'cd /opt/sensei-app && git pull && docker compose up -d --build'
git checkout test && git merge main
```

Schlägt `--ff-only` fehl, sind die Branches auseinandergelaufen — dann liegt
auf `main` ein Commit, der nie durch `test` gegangen ist.

### Testdaten

Die Testdatenbank ist eine Kopie der Produktion (Stand 31.08.2026), **ohne**
fremde Konten: dort liegt nur das eigene. Sitzungen und Passwort-Links werden
beim Kopieren geleert. Neu aufsetzen:

```bash
docker compose -f /opt/sensei-app/docker-compose.yml --project-directory /opt/sensei-app \
  exec -T db pg_dump -U sensei -d sensei --clean --if-exists < /dev/null > /tmp/prod.sql
cd /opt/sensei-test && docker compose exec -T db psql -q -U sensei -d sensei < /tmp/prod.sql
docker run --rm -v sensei-app_uploads:/von:ro -v sensei-test_uploads:/nach alpine cp -a /von/. /nach/
```

Ohne das Uploads-Volume laufen die Materialien in der Testinstanz ins Leere —
`material.dateiPfad` verweist auf Dateien, die es dort sonst nicht gibt.

**`docker compose exec -T` liest von stdin.** In einem Skript, das per SSH-Heredoc
läuft, frisst es den Rest des Skripts — deshalb überall `< /dev/null` anhängen.

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

Auf dem Server ausserhalb des Repos:

- `.env.production` enthält `CRON_SECRET`. **`REGISTRIERUNG_CODE` ist dort
  entfernt** — der Weg herein führt nur noch über Einladungslinks.
- Die Crontab von root ruft **stündlich** (`0 * * * *`)
  `scripts/nachtlauf.sh` auf, Log unter `/var/log/sensei-nachtlauf.log`.
  Dadurch 24 Einträge pro Tag statt einem — eine Log-Rotation gibt es noch
  nicht.
- **Der Container läuft auf UTC** — siehe *Zeitzonen*

## Projektstruktur

```
src/
├── app/
│   ├── page.tsx                  # Dashboard: laufende + nächste Sequenzen
│   ├── api/                      # alle prüfen die Session selbst (401)
│   │   ├── entwuerfe/nacht/      # Vorbereitungsdurchgang, CRON_SECRET
│   │   ├── upload/               # Datei-Upload für Modul-Material
│   │   ├── files/[...path]/      # nur eigenes Material, Cache private
│   │   └── modulplan/import/     # Modulplan + Aufgabenbaum aus Datei
│   ├── stundenplan/              # .ics-Import, Klassenzuordnung, Wochenübersicht
│   ├── klassen/                  # Klassen CRUD + Pendenzen
│   ├── sequenzen/
│   │   ├── actions.ts            # nur noch Lesen, Löschen, Notiz
│   │   ├── entwurf-actions.ts    # dünne Hüllen um lib/entwurf.ts
│   │   ├── uebertrag-actions.ts  # Übertrag + offene Überträge
│   │   └── [id]/                 # eine Ansicht, keine Umschaltung
│   │       ├── context-header.tsx
│   │       ├── stand-section.tsx        # Übertrag der Vorwoche
│   │       ├── ablauf-section.tsx       # das Arbeitsergebnis, bearbeitbar
│   │       ├── geschwister-section.tsx  # Parallelklassen
│   │       ├── wochenstoff-section.tsx  # Fakten aus dem Modulbaum
│   │       ├── uebertrag-section.tsx
│   │       └── notizen-section.tsx
│   ├── bildungsplan/             # HKB/HK, Module, Modulplan, Aufgabenbaum
│   └── materialien/              # Material-Übersicht + KI-Task-Extraktion
│   ├── (auth)/                   # Anmelden, Einladung, Passwort-Link
│   │                             #   (ohne UI Shell, siehe Proxy-Header)
│   ├── verwaltung/               # Konten, Einladungen — nur für Admins
│   ├── mein-konto/               # Profil, Passwort, Vorbereitungsdurchgang
├── components/
│   ├── ui/                       # Primitives, nach Carbon-Spezifikation
│   ├── shell/ui-shell.tsx        # Carbon UI Shell: Kopfleiste + SideNav
│   ├── delete-button.tsx         # Löschen über ein Carbon Danger-Modal
│   └── sortable-table-head.tsx   # sortierbare Kopfzelle einer DataTable
├── lib/
│   ├── ai.ts                     # Ollama-Aufruf + JSON-Parsing
│   ├── ics.ts                    # WebUntis-Kalenderexport
│   ├── smartlearn.ts             # Modularbeitsplan + Aufgabenbaum
│   ├── modulbaum.ts              # KW + Modul ⇒ Block ⇒ LA ⇒ Aufgaben
│   ├── kontext.ts                # Aggregation für den ContextHeader
│   ├── zeit.ts                   # Europe/Zurich statt UTC
│   ├── kw.ts                     # ISO-Kalenderwochen
│   ├── auth.ts                   # scrypt-Hashing, Session-Token
│   ├── dal.ts                    # aktuelleSession / aktuellerBenutzer
│   ├── entwurf.ts                # Entwurfsgenerator (nimmt benutzerId)
│   ├── uebertrag.ts              # vorheriger Übertrag (nimmt benutzerId)
│   ├── modul-lehrjahr.ts         # Modulnummer → Lehrjahr
│   ├── status.ts                 # Sequenz-Status als Carbon-Tag
│   ├── dokument-text.ts          # Text aus PDF/HTML/TXT
│   └── material-link.ts          # Deep-Links ins Material (#page=N)
└── db/
    ├── index.ts                  # DB-Verbindung (postgres-js + Drizzle)
    ├── schema.ts                 # Drizzle Schema
    ├── seed.ts                   # Bildungsplan EDB + AVIVA/PADUA
    ├── seed-modulplan-219.ts     # Plan aus einer Bildgrafik, von Hand
    └── migrate-*.ts              # Idempotente Migrations-Scripts
```

## Patterns

- **Server Actions** für alle Schreiboperationen (`"use server"` in
  `*-actions.ts`), **Server Components** für Seiten, **Client Components**
  nur für interaktive Teile
- Alle Tabellen nutzen **UUID** Primary Keys mit `defaultRandom()`,
  Cascading Deletes auf Foreign Keys
- **Erst deterministisch, KI nur als Fallback.** Alles, was aus einer Datei
  gelesen werden kann, wird gelesen — nicht generiert
- **KI-Ergebnisse sind Entwürfe**: anzeigen, prüfen lassen, bewusst bestätigen
- **Idempotente Importe**: erneut dieselbe Datei einlesen ändert nichts, ein
  aktualisierter Export korrigiert. Nie löschen, was Arbeit enthalten könnte —
  melden statt entfernen
- **Alle Routen sind dynamisch** (`force-dynamic` im Layout): der Badge für
  offene Überträge darf nicht aus der Build-Zeit stammen
- Datumsberechnungen **nie** über `new Date().toISOString()` — siehe *Zeitzonen*

## Bekannte Altlasten

- **Ungenutzte Tabellen aus dem alten Modell**: `lektionsblock`, `phase`,
  `sequenz_handlungskompetenz`, `sequenz_anker`, `semester`,
  `semester_klasse`, `kalender_eintrag`. Dort hängen drei Alt-Sequenzen ohne
  `kalender_kurs` als Archiv. Kein Code liest sie mehr; bewusst nicht
  gelöscht.
- Die **Coverage-Matrix** im Bildungsplan hat dadurch keine Datenbasis mehr.
- Aus `.pptx`/`.docx` kann kein Text gelesen werden — es fehlt ein
  OOXML-Parser. Präsentationen deshalb als **PDF** ablegen.
- `Button render={<Link/>}` erzeugt in der Dev-Overlay-Konsole eine
  Base-UI-Warnung (`nativeButton`). Kosmetisch, betrifft mehrere Seiten.
