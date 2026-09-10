# backlog
* aktuell ist der planer sehr stark auf berufskunde unterricht im edb ausgelegt. ander fächer funktionieren aber ganz anders. eine sprachlehrperson hat z.b. keine module sondern einfach eine sprache und unterrichtet pro semetester unterschiedliche schwerpunkte oder so. ABU lehrpersonen haben vermutlich unterrichtsblöcke die themenbasiert sind. solche sachen müssten pro lehrperson in den einstellungen eingestellt werden können. wie genau das aussieht wird aber vermutlich erst durch testing klar werden.

# ready

* (nichts offen)


# done
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
