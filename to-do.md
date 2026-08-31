# backlog
* aktuell ist der planer sehr stark auf berufskunde unterricht im edb ausgelegt. ander fächer funktionieren aber ganz anders. eine sprachlehrperson hat z.B. keine module sondern einfach eine sprache und unterrichtet pro semetester unterschiedliche schwerpunkte oder so. ABU lehrpersonen haben vermutlich unterrichtsblöcke die themenbasiert sind. solche sachen müssten pro lehrperson in den einstellungen eingestellt werden können. wie genau das aussieht wird aber vermutlich erst durch testing klar werden.

# ready

* KI-Bewertung der Abgaben (zweiter Schritt zu den Resultaten)
  * Qualität gegen Musterlösung (43 von 105 Aufgaben haben eine) und gegen die Theorieinhalte im Modulbaum
  * Beobachtungen statt KI-Wahrscheinlichkeit: Stilbruch gegen die eigenen übrigen Texte, fehlender Selbstbezug bei Fragen, die danach fragen
  * VOR jedem KI-Aufruf pseudonymisieren — nur Frage- und Antworttext, keine Namen
* Übertrag aus zwei Importen vorschlagen: die Differenz zeigt, was seit der letzten Lektion dazugekommen ist

# done
* \~\~**Smartlearn-Resultate einlesen und deterministisch auswerten**\~\~ (2026-08-31)
  * Parser ohne KI (`src/lib/smartlearn-resultate.ts`): Lehrpersonen erkannt, vorbefüllte Vorlagen abgezogen, LA-Codes fortgeschrieben
  * Vollständigkeit, Auswahlaufgaben gegen Musterlösung, Klassenbild, Verknüpfung mit dem geplanten Unterrichtstag
  * Gleiche Texte als **Gruppen** statt Paare — am echten Export 138 Treffer auf 1 reduziert
  * Bewusst wegwerfbar: `npx tsx src/db/drop-resultate.ts --wirklich`
* \~\~**Cockpit-Nachschärfung nach Interview-Abgleich** (KI-Bausteine als Anker im Cockpit, Prüfungen im Kontext-Hub, Smartlearn-Parser, Übergabenotiz-Vorschlag)\~\~ (2026-08-26)
  * Smartlearn-HTML-Export wird deterministisch gelesen (`src/lib/smartlearn.ts`) — Modularbeitsplan inkl. «LB:»-Leistungsbeurteilungen, ohne KI
  * KI-Bausteine erzeugen jetzt **Anker** (Tabelle `sequenz_anker`) im Cockpit statt Phasentabellen in der Planung
  * Kontext-Hub zeigt anstehende Beurteilungen aus Semesterkalender (`typ=pruefung`) **und** Modulplan-LB
  * Aufgaben behalten Original-Bezeichnung («Aufgabe 1 / Teilaufgabe 2») + Referenz springt bei PDFs via `#page=N`
  * Übergabenotiz: KI-Vorschlag als Entwurf, «(?)» markiert Unsicherheiten, Speichern bleibt manuell
  * Migration: `npx tsx src/db/migrate-anker.ts`
* \~\~**Sensei-Cockpit** (Datenmodell, Modulplan-Import, Kontext-Hub, KI-Material-Extraktion, Context-Header, Cockpit-Ansicht, Ansichts-Toggle, KI-Bausteine)\~\~ (2026-08-26)
  * Neue Tabellen: `modular_plan`, `material_task`, zusätzlich `pendenz` (für Klassen-Pendenzen im Kontext-Hub) und Spalte `sequenz.cockpit_notiz` (freie Cockpit-Notizen). Migration: `npx tsx src/db/migrate-cockpit.ts`
  * Modulplan-Import: JSON direkt, HTML/PDF/Freitext per KI normalisiert (`unpdf` für PDF-Text). UI unter Bildungsplan → Module → Modul wählen
  * Kontext-Hub: `src/lib/kontext.ts` (`getSequenzKontext`) — KW-Ziel, Übergabenotiz, offene Pendenzen
  * Cockpit: Toggle Planung/Cockpit über `?ansicht=cockpit` auf der Sequenz-Detailseite
  * KI-Bausteine «Aktivierender Einstieg» / «Repetitionsblock» hängen einen neuen Lektionsblock ans Ende an
* \~\~bildungsplan HKB-Karten aufklappbar mit Beschreibung, Lernzielen und Modulnamen\~\~ (2026-08-20)
* \~\~KI-Prompt-Generierung: Button auf Sequenz-Formular und Detailseite, generiert Prompt mit Kontext\~\~ (2026-08-20)
* \~\~KI-Output importierbar: JSON-Import für Lektionsblöcke auf der Detailseite\~\~ (2026-08-20)
* \~\~tabellen-sortierung auf klassen/semester/sequenzen seite\~\~ (2026-08-19)
* \~\~modul-filter nach lehrjahr bei sequenz-erstellung\~\~ (2026-08-19)
* \~\~übergabenotiz zwischen sequenzen gleicher klasse+modul\~\~ (2026-08-19)
* \~\~ aktuell habe wir ein tool das als manuelles unterrichtsplanungstool begonnen hat und dann mit AI erweitert wurde und das merkt man, der Ansatz stimmt für mi momentan nicht. Folgende punkte sollten überarbeitet werden:
* grundlegend:
	* Semester sollte auf Grund der Datumsauswahl automatisch ausgefüllt werden.
	* Datei upload für Unterrichtsmaterial pro Modul
* zwei erstellungs Modi
	* Manuell:
		* man gibt klasse, Modul (fach) und Datum und Anzahl lektionen ein
		* wählt das phasenmodell
		* plant die einzelnen Phasen manuell
	* KI gestützt:
		* man gibt klasse, Modul (fach) und Datum und Anzahl lektionen ein
		* wählt das phasenmodell
		* man gibt an welches materiel für diese Unterrichtssequenz relevant ist
		* in welcher form man Vorwissen aktivieren möchte
		* welche aufgaben in dieser sequnez gelöst werden sollen
		* auf Basis dieser Daten erstellt die per API verknüpfte KI einen unterrichtsplan nach dem gewünschten Phasenmodell \~\~
