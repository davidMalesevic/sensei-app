# Erstellungsprozess für Unterrichtssequenzen — Redesign

Ergebnis des Interviews vom 27.08.2026. Nachfolger von `redesign.md` (Cockpit).
Dieses Dokument ist die Messlatte für die Umsetzung — nicht eine daraus
abgeleitete Task-Liste.

## 1. Befund

Der heutige Weg lautet `/sequenzen/neu` → Formular → speichern → Detailseite →
dort erst KI, Anker und Material. Die Lehrperson muss die App zuerst bedienen,
bevor die App ihr hilft.

Das Formular verlangt vorab Klasse, Modul, Datum, Titel, Blocktyp und
Phasenmodell. **Alle diese Angaben stehen bereits im Stundenplan.** Es ist
Abschreibarbeit, keine Denkarbeit.

Entscheidend ist die Menge: der Kalenderexport ergibt **14 Wochen mit exakt
7 Sequenzen**. Der heutige Prozess bedeutet also 7 Formulardurchläufe pro
Vorbereitungsblock, bevor irgendetwas Nützliches entsteht. Das ist das
eigentliche Problem — nicht die Anordnung der Felder.

## 2. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Sequenz** | Eine Klasse × ein Modul × ein Unterrichtstag. Beginnt und endet am selben Tag, egal ob 2 oder 4 Lektionen. Entsteht aus dem Kalender, nicht aus einem Formular. |
| **Ablauf** | Die 8–10 Zeilen, die im Cockpit stehen. Das eigentliche Arbeitsergebnis. |
| **Entwurf** | Ein von der KI vorgeschlagener Ablauf, ungeprüft. |
| **Übertrag** | Notiz nach der Lektion: bis wo gekommen, was ist offen. Eingabe der Lehrperson, nicht ableitbar. |
| **Modulmaterial** | Präsentation und Smartlearn-Export. Hängt am **Modul**, nicht an der Sequenz. |

## 3. Der Wochenrhythmus

Unterricht: Dienstag ganztags (2 Klassen à 4 Lektionen), Donnerstagnachmittag
(1 Klasse à 4 Lektionen), Freitag ganztags (4 Blöcke à 2 Lektionen, 3 Klassen).

Vorbereitungsfenster: **Mittwoch und Donnerstagmorgen**. Darin werden geplant:
Donnerstagnachmittag, Freitag und der folgende Dienstag — also ~7 Sequenzen.

Vor dem Unterricht wird nur noch das Cockpit geöffnet. Rückwirkend wird so wenig
wie möglich nachgetragen: ausschliesslich der Übertrag.

```
Mo   Di Unterricht   Mi Vorbereitung   Do Vorb. / Unterricht   Fr Unterricht
                     ↑ Entwürfe schleifen und bestätigen
     ↓ Übertrag           ↓ Übertrag                  ↓ Übertrag
```

## 4. Datenquellen

### 4.1 Stundenplan (`.ics` aus WebUntis)

Ersetzt die gesamte Stammdateneingabe. Analyse von `assets/MLD.ics`:

- 182 `VEVENT` → **106 Sequenzen**, Zeitraum 20.08.2026 – 14.01.2027
- `SUMMARY`: `<Klassenkürzel> <Modulnr> <Modulbezeichnung> (<Modulnr>)`
  Die Modulnummer in Klammern am Ende ist der zuverlässige Anker.
- `LOCATION`: Raum
- `UID`: `<Kursprefix>-<Lektions-IDs>` — der Präfix ist über alle Termine eines
  Kurses stabil (10 distinkte Kurse) und dient als Schlüssel.

**Eigenheit — Pausen zerschneiden Blöcke.** Die Pausen 09:20–09:35 und
15:15–15:30 erzeugen zwei separate Termine für denselben Unterrichtsblock.

> **Merge-Regel:** gleicher UID-Präfix + gleicher Tag + Lücke ≤ 20 min
> → eine Sequenz.

Verifiziert: 08:35–09:20 und 09:35–10:20 verschmelzen korrekt, 10:25–12:00
bleibt eigenständig.

**Eigenheit — Doppelkürzel.** `BM1WEDB24z\; EDB24z` ist **eine**
Unterrichtsgruppe (intern «MED24A»), nicht zwei Klassen. Der Import braucht
darum eine einmalige Zuordnungstabelle *Kalenderkürzel → Anzeigename*.

Vorkommende Kürzel: `BM1WEDB24z; EDB24z` (60), `BM1WEDB26z; EDB26z` (32),
`EDB25b` (30), `EDB25a` (30), `EDB24a` (15), `EDB24b` (15).
Module: 119, 168, 219, 230, 278, 349.

Das **Semester entfällt als Konzept** — der Export deckt den Zeitraum ab.

### 4.2 Smartlearn-Export (HTML-Ordner)

Strukturell ausreichend für deterministisches Parsen, ohne KI. Aus
`assets/exam_ple/index.html`: 57 Überschriften, 24 Aufgaben-Marker.

```
Block 01 – Einführung
└─ LA_119_1000_Kommunikationstechniken
   ├─ Ausgangslage / Aufgabenstellung
   ├─ Aufgabe 1 → Teilaufgabe 1, Teilaufgabe 2
   ├─ Aufgabe 2
   ├─ Aufgabe 3
   └─ Gütekriterien
```

Zusammen mit dem Modularbeitsplan (KW → Block) gilt:

> **KW + Modul ⇒ Block ⇒ LA ⇒ exakte Aufgabenliste.** Reine Rechnung, keine KI.

Damit ist das «mühsame Lesen aller Aufgaben» erledigt. Originalbezeichnungen
bleiben unverändert («Aufgabe 4.2», LA-Codes) — die Lehrperson muss der Klasse
sagen können «macht Aufgabe 4.2».

PDF-Export von Smartlearn ist unbrauchbar (zerschossen), JSON ungeprüft.
**HTML ist der Weg.**

### 4.3 Präsentationen

**Als PDF-Export.** Seite = Slide, Text lesbar über `unpdf`, Deep-Link
`#page=20` existiert bereits. `.pptx` bräuchte einen OOXML-Parser — nicht gebaut,
solange der PDF-Export zumutbar ist.

Zuordnung ist modulabhängig: mal eine Präsentation fürs ganze Modul, mal eine
pro Block. Ein Mechanismus für beides:

- Jede hochgeladene Datei bekommt ein **Etikett**: «ganzes Modul» oder «Block NN».
- Bei modulweiter Präsentation zusätzlich einmalig eine Slidezuordnung
  (Block 01 → 1–14, Block 02 → 15–28, …).
- Bei Präsentationen pro Block entfällt die Zuordnung.

## 5. Der Entwurf

### 5.1 Erzeugung

**Nachtlauf.** Die KI generiert nachts für alle anstehenden Sequenzen einen
Ablaufentwurf. Grund: morgens soll die Session frisch sein, nicht schon halb
verbraucht. Zusätzlich ein **Knopf zum manuellen Anstossen**.

Fehlt der Übertrag der Vorwoche, plant der Nachtlauf trotzdem — aber die Sequenz
wird sichtbar als «Stand der Vorwoche unbekannt» markiert.

### 5.2 Anatomie

Der Ablauf ist eine geordnete Liste von Zeilen. Beispiel:

```
Einstieg      Vorwissen aktivieren: …                    [Vorschlag]
Praxisbezug   …                                          [Vorschlag]
Theorie       Präsentation Modul 168, Slides 12–20       [Faktum → Deep-Link]
Aufgabe       LA_168_1002, Aufgabe 1 (Teilaufgabe 1–2)   [Faktum → Deep-Link]
Besprechung   Plenum                                     [Vorschlag]
Theorie       Slides 21–30                               [Faktum]
Aufgabe       Aufgabe 2                                  [Faktum]
Abschluss     …                                          [Vorschlag]
```

Zwingend ist nur: **am Anfang steht eine Vorwissensaktivierung**, und in der
Regel ein Praxisbezug. Die restliche Dramaturgie darf die KI variieren —
4-Lektionen-Blöcke sehen anders aus als 2er.

**Phasenmodelle (AVIVA/PADUA) wirken unsichtbar im Prompt.** Sie steuern die
didaktische Qualität des Vorschlags, erscheinen aber nie als Tabelle in der UI.
Optional soll man sie sich trotzdem anzeigen lassen können.

### 5.3 Fakten vs. Vorschläge

Aufgabennummern, LA-Codes und Slidebereiche sind **Fakten aus dem Material** und
dürfen nicht halluziniert werden — sie werden aus dem Parser gesetzt und
verlinken ins Material. Vorwissensaktivierung, Praxisbezug und Methodik sind
**KI-Vorschläge**.

Der Unterschied wird im Cockpit **markiert**. Versuchsweise — falls sich die
Markierung als Lärm erweist, fliegt sie wieder raus.

## 6. Interaktionen

### 6.1 Mittwoch-Durchgang

Einstiegsseite: die zu planenden Sequenzen **chronologisch** (Donnerstag,
Freitag, folgender Dienstag), **nach Modul gruppiert**, je mit Status
(leer / Entwurf / bestätigt / gehalten).

### 6.2 Schleifen

**Direktmanipulation, kein KI-Ping-Pong.**

- Ablaufzeilen per **Drag & Drop** umordnen
- Textinhalte **inline bearbeiten**
- Zeilen löschen und hinzufügen

Danach **bestätigen** — Entwurf und bestätigter Ablauf sind unterscheidbar.

### 6.3 Wiederverwendung über Klassen (Variante B)

Dasselbe Modul läuft mit mehreren Klassen — am Freitag zweimal Modul 168 am
Vormittag, zweimal Modul 219 am Nachmittag; dienstags derselbe Fall.

**Zwei Einträge, nicht einer.** Die zweite Sequenz zeigt «übernommen von
EDB24z — abweichen?». Der Ablauf ist anfangs identisch, Fortschritt und Notizen
bleiben pro Klasse getrennt.

Ziel ist Gleichstand der Klassen. Driften sie auseinander, muss das bei der
Planung der Folgewoche **sichtbar** sein.

### 6.4 Übertrag

Nach der Lektion, ein Feld:

- Häkchen-Vorschläge aus dem Ablauf («Aufgabe 1 ✓, Aufgabe 2 ✓, Slides bis 22»)
- Freitext für alles Weitere
- Knopf **«kein Übertrag»**

Automatisierung ist hier nicht möglich — die App kann nichts wissen, was nicht
getippt wird. Stattdessen **abendliche Prüfung**: fehlt der Übertrag, erscheint
ein roter Punkt in der App (E-Mail wäre nice-to-have, lohnt die Infrastruktur
vorerst nicht).

### 6.5 Prüfungen

`LB:`-Zeilen aus dem Modularbeitsplan. Eine Prüfungssequenz zeigt statt eines
Ablaufentwurfs die **Prüfungsinfos und erlaubten Hilfsmittel**. Der Raum kommt
wie immer aus dem Kalender.

## 7. Entscheidungen

| Entscheidung | Konsequenz |
|---|---|
| Sequenz = Klasse × Modul × Tag | Kein Sequenzbegriff über mehrere Tage mehr |
| Stammdaten kommen aus `.ics` | `/sequenzen/neu` und `sequenz-form.tsx` entfallen |
| Semester entfällt | Semesterverwaltung wird bedeutungslos |
| **Detailplanung verschwindet ganz** | Lektionsblöcke, Phasen, HK-Auswahl, Beschreibung, Praxisbezug-Feld fallen weg |
| **Coverage-Matrix verliert Datenbasis** | Bewusst akzeptiert. Billigster Ersatz später: KI-Vorschlag «diese Sequenz deckt HK a2, b1 ab», ungepflegt |
| Phasenmodelle nur im Prompt | Bleiben als Seed-Daten, verschwinden aus der UI |
| **Sauberer Neuaufbau** | `.ics`-Import legt Klassen und Sequenzen frisch an; alte Sequenzen bleiben als Archiv, vom neuen Prozess abgekoppelt |
| Präsentationen als PDF | Kein OOXML-Parser, solange der Export zumutbar ist |

## 8. Umsetzungsreihenfolge

Nach Hebelwirkung, nicht nach technischer Bequemlichkeit:

1. **`.ics`-Import + Klassenzuordnung** — Sequenzen entstehen von selbst.
   Killt das Formular. Grösster einzelner Gewinn.
2. **Modulmaterial mit Etiketten** + Ausbau `smartlearn.ts` auf den vollen
   Baum Block → LA → Aufgabe → Teilaufgabe.
3. **Übertrag-Feld + roter Punkt** — die einzige Eingabe, die bleibt.
4. **Entwurfsgenerator** (nachts + manuell), Fakten aus dem Parser,
   Vorschläge von der KI, Phasenmodelle im Prompt.
5. **Schleif-UI** — Drag & Drop, Inline-Edit, Bestätigen.
6. **Wiederverwendung Variante B.**
7. **Aufräumen** — Formular, Phasen, Blöcke, Semester entfernen.

## 9. Offene Punkte

- Modularbeitspläne liegen bisher nur für einen Teil der 6 Module vor.
  Ohne Modulplan gibt es keine KW→Block-Zuordnung — Fallback nötig.
- Nachtlauf braucht einen Scheduler im Docker-Compose (Cron-Container oder
  In-App-Scheduler).
- Slidezuordnung Block→Seitenbereich: einmalige Pflege pro Modul, UI noch offen.
