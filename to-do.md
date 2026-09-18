# backlog
* aktuell ist der planer sehr stark auf berufskunde unterricht im edb ausgelegt. ander fächer funktionieren aber ganz anders. eine sprachlehrperson hat z.b. keine module sondern einfach eine sprache und unterrichtet pro semetester unterschiedliche schwerpunkte oder so. ABU lehrpersonen haben vermutlich unterrichtsblöcke die themenbasiert sind. solche sachen müssten pro lehrperson in den einstellungen eingestellt werden können. wie genau das aussieht wird aber vermutlich erst durch testing klar werden.

# ready

* grosses update zur erstellung von aktivierenden unterrichtssequenzen. im assets ordner liegt ein json file mit diveresen methoden und dazugehörigen prompts welche verwendet werden können um aktivierende unterrichtssequenzen zu erstellen. einerseis sollen diese in einem neuen bereich der app eingesehen, verwaltet und bearbeitet werdet können, andererseits sollen sie bei der unterrichtsplanung (allen voran bei der erstellung von aktivierenden unterrichtssequenzen) angewendet werden.
  * Entscheide (2026-09-17), Quelle `assets/vorwissen_methoden_prompts.json` (62 Methoden, 12 mit `daten_json`):
    * **Zweistufig:** Der Generator wählt die Methode aus der Bibliothek statt aus dem fest eingebauten Methodenstrauss (`entwurf.ts`). «Einstieg ausarbeiten» an der Einstiegszeile erzeugt das volle Paket nur auf Wunsch.
    * **Besitz:** Geteilte Bibliothek, die ein Admin pflegt. Wer eine Methode anpasst, bekommt eine eigene Fassung, die nur fürs eigene Konto gilt. Neue Methoden sind privat.
    * **Bearbeitbar:** Stammdaten, Anweisung + Parameter, an/aus fürs eigene Konto, neue Methoden. System-Prompt, User-Template und Ausgabeschema sind nicht in der Oberfläche bearbeitbar.
    * **Grundsatz 1 im System-Prompt anpassen:** Einstieg mitten im Modul, anknüpfen an Abgehaktes, Überträge und Wochenziele (`vorwissen.ts` → `vorkenntnisse`).
    * **Lerninhalt:** Blocktitel, Wochenziel, Aufgabentexte aus dem Modulbaum + Text der Block-Präsentation (bei modulweiter Präsentation nur der Slidebereich).
    * **Paket an der Einstiegszeile:** aufklappbar, mit Druck- und Beamer-Ansicht (Material für Lernende getrennt von den Lösungen). Erneutes Ausarbeiten ersetzt das Paket, eine festgezurrte Zeile behält es, «Von <Klasse> holen» kopiert es mit.
    * **Visualisierungen gleich mitbauen:** Mindmap, Begriffsnetz, Advance Organizer (Mermaid), Kreuzworträtsel, Memory, Tabu, Jeopardy, Escape-Room.
    * **Quiz:** anzeigen + Download im Kahoot-Importformat (.xlsx).
  * Stand 18.09.2026: Teil 1 und 2 sind **auf der Produktion**.
    * Teil 1: Bibliothek, Bereich `/methoden`, eigene Fassungen, Ein/Aus, Einlesen durch Admins.
    * Teil 2: Methodenwahl im Generator, «Einstieg ausarbeiten» samt Ansicht zum Austeilen und Beamer, Markdown-Darstellung.
    * Nachgezogen: Methodenliste gemischt + aktuelle Methode ausgeschlossen (sonst kam zweimal dieselbe), Methode an der Zeile wählbar, einzelne Schritte neu erzeugen.
    * Teil 3: Visualisierungen aus `daten_json` (Mindmap, Begriffsnetz, Advance Organizer/Mermaid, Kreuzworträtsel mit eigenem Gittergenerator, Memory, Tabu, Jeopardy, Escape-Room, Listenformate) und der Kahoot-Export (.xlsx). Erledigt 18.09.2026.
    * **Noch zu prüfen:** ob Kahoot die erzeugte .xlsx tatsächlich annimmt — das lässt sich nur dort ausprobieren.


# done
* \~\~**Kommentare an einzelnen Abschnitten**\~\~ (2026-09-11)
  * Kommentarfeld an jedem Ablaufschritt; fliesst beim Neu-Erzeugen in den Prompt
  * Hängt am Anker (`fakt:<marke>` / `typ:<art>`), nicht an der Zeile — überlebt das Erzeugen
  * Bleibt stehen, bis man ihn leert; Kommentare ohne Schritt stehen unter dem Ablauf
  * Nachtlauf gruppiert danach und übernimmt keinen fremden Ablauf, wenn Kommentare da sind
  * Migration: `npx tsx src/db/migrate-ablauf-hinweise.ts`
* \~\~**Der Ablauf gehört der Lehrperson**\~\~ (2026-09-10)
  * Schritte festzurren (`sequenz_ablauf.gesperrt`) — überleben «Neu erzeugen» unverändert und behalten ihren Platz
  * «Nur bestimmte neu erzeugen» ergibt sich daraus: festzurren, was bleiben soll
  * Aufgaben aus einer Lektion entfernen (`sequenz.ausgeschlossene_fakten`) — bleiben offen, stehen in Folgewochen als Rückstand, mit «Zurückholen»
  * Migration: `npx tsx src/db/migrate-ablauf-sperren.ts`
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
