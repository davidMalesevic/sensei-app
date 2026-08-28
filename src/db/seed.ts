import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dotenv from "dotenv";
import {
  bildungsplan,
  handlungskompetenzbereich,
  handlungskompetenz,
  phasenmodell,
  phasenTemplate,
} from "./schema";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function seed() {
  console.log("Seeding Bildungsplan EDB...");

  // ─── Bildungsplan EDB ───
  const [bp] = await db
    .insert(bildungsplan)
    .values({
      bezeichnung: "Entwicklerin / Entwickler digitales Business EFZ",
      berufsnummer: "69201",
      version: "BiVo 2023",
    })
    .returning();

  // ─── HKB a: Begleiten von Projekten ───
  const [hkbA] = await db
    .insert(handlungskompetenzbereich)
    .values({
      bildungsplanId: bp.id,
      kuerzel: "a",
      bezeichnung: "Begleiten von Projekten",
      sortierung: 1,
    })
    .returning();

  await db.insert(handlungskompetenz).values([
    {
      bereichId: hkbA.id,
      kuerzel: "a1",
      bezeichnung: "Ausgangslage eines Geschäftsvorhabens ermitteln und Erfolgskriterien festlegen",
      moduleBerufsfachschule: [278, 331, 332],
      sortierung: 1,
    },
    {
      bereichId: hkbA.id,
      kuerzel: "a2",
      bezeichnung: "Ideen für innovative Geschäftslösungen entwerfen",
      moduleBerufsfachschule: [336, 338, 394, 395],
      sortierung: 2,
    },
    {
      bereichId: hkbA.id,
      kuerzel: "a3",
      bezeichnung: "Projektplanung von digitalen Business-Projekten entsprechend dem gewählten Vorgehensmodell anpassen",
      moduleBerufsfachschule: [134, 213, 224, 337],
      sortierung: 3,
    },
    {
      bereichId: hkbA.id,
      kuerzel: "a4",
      bezeichnung: "Einfache Projekte und deren Aufgaben im Bereich digitales Business planen",
      moduleBerufsfachschule: [134, 224, 332, 333, 337],
      sortierung: 4,
    },
    {
      bereichId: hkbA.id,
      kuerzel: "a5",
      bezeichnung: "Fortschritt von Projekten im Bereich digitales Business überprüfen und festhalten",
      moduleBerufsfachschule: [224, 333, 337],
      sortierung: 5,
    },
    {
      bereichId: hkbA.id,
      kuerzel: "a6",
      bezeichnung: "Erfolg und Wirkung von Geschäftslösungen überprüfen und bei Bedarf Optimierungsmassnahmen einleiten",
      moduleBerufsfachschule: [333, 337, 339],
      sortierung: 6,
    },
  ]);

  // ─── HKB b: Darstellen, Automatisieren und Optimieren von Geschäftsprozessen ───
  const [hkbB] = await db
    .insert(handlungskompetenzbereich)
    .values({
      bildungsplanId: bp.id,
      kuerzel: "b",
      bezeichnung: "Darstellen, Automatisieren und Optimieren von Geschäftsprozessen",
      sortierung: 2,
    })
    .returning();

  await db.insert(handlungskompetenz).values([
    {
      bereichId: hkbB.id,
      kuerzel: "b1",
      bezeichnung: "Geschäftsprozesse erfassen und beschreiben",
      moduleBerufsfachschule: [224, 230, 254, 396],
      sortierung: 1,
    },
    {
      bereichId: hkbB.id,
      kuerzel: "b2",
      bezeichnung: "Geschäftsprozesse modellieren",
      moduleBerufsfachschule: [254, 349],
      sortierung: 2,
    },
    {
      bereichId: hkbB.id,
      kuerzel: "b3",
      bezeichnung: "Kundenerlebnisse darstellen und mit Geschäftsprozessen vergleichen",
      moduleBerufsfachschule: [224, 349, 367],
      sortierung: 3,
    },
    {
      bereichId: hkbB.id,
      kuerzel: "b4",
      bezeichnung: "Kritische Punkte in Geschäftsprozessen dokumentieren",
      moduleBerufsfachschule: [168, 224, 349, 367],
      sortierung: 4,
    },
    {
      bereichId: hkbB.id,
      kuerzel: "b5",
      bezeichnung: "Lösungs- und Optimierungsmöglichkeiten für Geschäftsprozesse im Team entwickeln und festlegen",
      moduleBerufsfachschule: [168, 213, 224, 349, 367],
      sortierung: 5,
    },
    {
      bereichId: hkbB.id,
      kuerzel: "b6",
      bezeichnung: "Einfache Geschäftsprozesse automatisieren",
      moduleBerufsfachschule: [168, 367, 325],
      sortierung: 6,
    },
    {
      bereichId: hkbB.id,
      kuerzel: "b7",
      bezeichnung: "Automatisierungsaufträge mit Spezialistinnen und Spezialisten koordinieren",
      moduleBerufsfachschule: [224, 367],
      sortierung: 7,
    },
    {
      bereichId: hkbB.id,
      kuerzel: "b8",
      bezeichnung: "Anforderungen an automatisierte Geschäftsprozesse überprüfen",
      moduleBerufsfachschule: [367],
      sortierung: 8,
    },
  ]);

  // ─── HKB c: Analysieren von Daten ───
  const [hkbC] = await db
    .insert(handlungskompetenzbereich)
    .values({
      bildungsplanId: bp.id,
      kuerzel: "c",
      bezeichnung: "Analysieren von Daten",
      sortierung: 3,
    })
    .returning();

  await db.insert(handlungskompetenz).values([
    {
      bereichId: hkbC.id,
      kuerzel: "c1",
      bezeichnung: "Daten für einen Analyseauftrag im Team definieren und das Vorgehen für die Datenerhebung erarbeiten",
      moduleBerufsfachschule: [164, 224, 278, 332, 377, 392],
      sortierung: 1,
    },
    {
      bereichId: hkbC.id,
      kuerzel: "c2",
      bezeichnung: "Bestehende Daten aus verschiedenen Quellen sammeln oder bei externen Stellen einholen",
      moduleBerufsfachschule: [164, 231, 319, 377, 392],
      sortierung: 2,
    },
    {
      bereichId: hkbC.id,
      kuerzel: "c3",
      bezeichnung: "Daten erheben",
      moduleBerufsfachschule: [164, 231, 319, 374, 377, 392],
      sortierung: 3,
    },
    {
      bereichId: hkbC.id,
      kuerzel: "c4",
      bezeichnung: "Daten strukturieren und zusammenführen",
      moduleBerufsfachschule: [162, 164, 224, 377, 392],
      sortierung: 4,
    },
    {
      bereichId: hkbC.id,
      kuerzel: "c5",
      bezeichnung: "Daten bereinigen",
      moduleBerufsfachschule: [164, 377, 378, 392],
      sortierung: 5,
    },
    {
      bereichId: hkbC.id,
      kuerzel: "c6",
      bezeichnung: "Daten auswerten und einfache Reporte erstellen",
      moduleBerufsfachschule: [164, 224, 375, 377, 379, 392],
      sortierung: 6,
    },
  ]);

  // ─── HKB d: Kommunizieren von Ergebnissen ───
  const [hkbD] = await db
    .insert(handlungskompetenzbereich)
    .values({
      bildungsplanId: bp.id,
      kuerzel: "d",
      bezeichnung: "Kommunizieren von Ergebnissen",
      sortierung: 4,
    })
    .returning();

  await db.insert(handlungskompetenz).values([
    {
      bereichId: hkbD.id,
      kuerzel: "d1",
      bezeichnung: "Ausgewertete Daten visualisieren und kommentieren",
      moduleBerufsfachschule: [119, 224, 229, 235, 278, 282, 370, 373],
      sortierung: 1,
    },
    {
      bereichId: hkbD.id,
      kuerzel: "d2",
      bezeichnung: "Ausgewertete Daten im Team interpretieren und Lösungsvorschläge erarbeiten",
      moduleBerufsfachschule: [119, 213, 224, 229, 235, 282, 370],
      sortierung: 2,
    },
    {
      bereichId: hkbD.id,
      kuerzel: "d3",
      bezeichnung: "Lösungsvorschläge den Auftraggebenden präsentieren und erläutern",
      moduleBerufsfachschule: [220, 229, 282, 370, 371],
      sortierung: 3,
    },
    {
      bereichId: hkbD.id,
      kuerzel: "d4",
      bezeichnung: "Meetings und Workshops planen und moderieren",
      moduleBerufsfachschule: [119, 220, 229, 279, 370, 371, 373],
      sortierung: 4,
    },
  ]);

  // ─── HKB e: Einführen von Lösungen im digitalen Umfeld ───
  const [hkbE] = await db
    .insert(handlungskompetenzbereich)
    .values({
      bildungsplanId: bp.id,
      kuerzel: "e",
      bezeichnung: "Einführen von Lösungen im digitalen Umfeld",
      sortierung: 5,
    })
    .returning();

  await db.insert(handlungskompetenz).values([
    {
      bereichId: hkbE.id,
      kuerzel: "e1",
      bezeichnung: "Benutzerdokumentationen für digitale Lösungen erstellen",
      moduleBerufsfachschule: [219],
      sortierung: 1,
    },
    {
      bereichId: hkbE.id,
      kuerzel: "e2",
      bezeichnung: "Schulungsunterlagen für die Einführung von digitalen Lösungen erarbeiten",
      moduleBerufsfachschule: [219],
      sortierung: 2,
    },
    {
      bereichId: hkbE.id,
      kuerzel: "e3",
      bezeichnung: "Benutzerinnen und Benutzer im Umgang mit digitalen Lösungen befähigen",
      moduleBerufsfachschule: [219, 372],
      sortierung: 3,
    },
    {
      bereichId: hkbE.id,
      kuerzel: "e4",
      bezeichnung: "Die Inbetriebnahme von digitalen Lösungen vorbereiten und unterstützen",
      moduleBerufsfachschule: [218],
      sortierung: 4,
    },
  ]);

  console.log("Bildungsplan EDB erfolgreich geseedet (5 HKB, 28 HK).");

  // Module werden NICHT mehr geseedet: seit der Datentrennung gehören sie
  // je einem Benutzer und entstehen beim Stundenplan-Import. Die Zuordnung
  // Nummer → Lehrjahr steht in `src/lib/modul-lehrjahr.ts`.

  // ─── Phasenmodell AVIVA ───
  console.log("Seeding Phasenmodelle...");

  const [aviva] = await db
    .insert(phasenmodell)
    .values({
      name: "AVIVA",
      beschreibung:
        "Phasenstruktur für kompetenzorientierte Lehr-Lerneinheiten: Ankommen, Vorwissen aktivieren, Informieren, Verarbeiten, Auswerten",
    })
    .returning();

  await db.insert(phasenTemplate).values([
    {
      phasenmodellId: aviva.id,
      kuerzel: "+",
      bezeichnung: "Lernatmosphäre schaffen",
      zweck: "Vertrauensvolle Umgebung und positive emotionale Grundgestimmtheit schaffen",
      methodenVorschlaege: ["Dreieck der Gemeinsamkeiten", "Netzwerk der Gemeinsamkeiten"],
      sortierung: 0,
      optional: true,
    },
    {
      phasenmodellId: aviva.id,
      kuerzel: "A",
      bezeichnung: "Ankommen und einstimmen",
      zweck: "Bereitschaft schaffen, sich auf Neues einzulassen. Lernziele und Ablauf bekanntgeben.",
      methodenVorschlaege: [
        "Focus Writing im Lerntagebuch",
        "Impuls",
        "Kartenabfrage mit Priorisierung",
        "Kopfstandmethode",
        "Wissenspool",
      ],
      sortierung: 1,
      optional: false,
    },
    {
      phasenmodellId: aviva.id,
      kuerzel: "V/R",
      bezeichnung: "Vorwissen aktivieren / reaktivieren",
      zweck: "Vorwissen identifizieren und mit Neuem verbinden (Konstruktivismus).",
      methodenVorschlaege: [
        "Kopfstandmethode",
        "Murmelgruppe",
        "Peer Instruction",
        "Wissenspool",
      ],
      sortierung: 2,
      optional: false,
    },
    {
      phasenmodellId: aviva.id,
      kuerzel: "I",
      bezeichnung: "Informieren",
      zweck: "Neue Informationen als Grundlage für den weiteren Kompetenzaufbau vermitteln.",
      methodenVorschlaege: [
        "Erklärvideo im Selbststudium",
        "Frontalvortrag",
        "Impuls",
        "Lehrgespräch",
        "Vorlesung",
      ],
      sortierung: 3,
      optional: false,
    },
    {
      phasenmodellId: aviva.id,
      kuerzel: "V",
      bezeichnung: "Verarbeiten",
      zweck: "Neu Gelerntes operationalisieren, vertiefen, üben und festigen.",
      methodenVorschlaege: ["Murmelgruppe", "Peer Instruction", "Think-Pair-Share"],
      sortierung: 4,
      optional: false,
    },
    {
      phasenmodellId: aviva.id,
      kuerzel: "A",
      bezeichnung: "Auswerten",
      zweck: "Lernerfolg überprüfen und den Lehr-Lernprozess reflektieren.",
      methodenVorschlaege: [
        "Aufgabenstellung mit beobachtbarem Ergebnis",
        "Lerntagebuch",
        "Reflexionsfragen",
      ],
      sortierung: 5,
      optional: false,
    },
  ]);

  // ─── Phasenmodell PADUA ───
  const [padua] = await db
    .insert(phasenmodell)
    .values({
      name: "PADUA",
      beschreibung:
        "Didaktisches Konzept nach Hans Aebli: Problemdarstellung, Aufbau, Durcharbeiten, Ueben, Anwenden",
    })
    .returning();

  await db.insert(phasenTemplate).values([
    {
      phasenmodellId: padua.id,
      kuerzel: "P",
      bezeichnung: "Problemdarstellung",
      zweck: "In die Thematik einführen und durch kontroverse Inhalte Lernmotivation wecken.",
      methodenVorschlaege: [
        "Provokante These",
        "Fallbeispiel",
        "Problemstellung aus der Praxis",
        "Video-Impuls",
      ],
      sortierung: 1,
      optional: false,
    },
    {
      phasenmodellId: padua.id,
      kuerzel: "A",
      bezeichnung: "Aufbau",
      zweck: "Lerninhalt systematisch aufbauen und neue Konzepte einführen.",
      methodenVorschlaege: [
        "Lehrgespräch",
        "Lehrervortrag",
        "Demonstration",
        "Guided Discovery",
      ],
      sortierung: 2,
      optional: false,
    },
    {
      phasenmodellId: padua.id,
      kuerzel: "D",
      bezeichnung: "Durcharbeiten",
      zweck: "Lerninhalt festigen, konkretisieren und vertiefen.",
      methodenVorschlaege: [
        "Übungsaufgaben",
        "Fallstudien",
        "Gruppenarbeit",
        "Partnerarbeit",
      ],
      sortierung: 3,
      optional: false,
    },
    {
      phasenmodellId: padua.id,
      kuerzel: "U",
      bezeichnung: "Üben",
      zweck: "Speicherung im Langzeitgedächtnis durch Wiederholung sicherstellen.",
      methodenVorschlaege: [
        "Wiederholungsübungen",
        "Quiz",
        "Lernkarten",
        "Praxisaufgaben",
      ],
      sortierung: 4,
      optional: false,
    },
    {
      phasenmodellId: padua.id,
      kuerzel: "A",
      bezeichnung: "Anwenden",
      zweck: "Lerninhalt in neuen Kontexten anwenden können.",
      methodenVorschlaege: [
        "Transferaufgabe",
        "Projektarbeit",
        "Praxisauftrag",
        "Rollenspiel",
      ],
      sortierung: 5,
      optional: false,
    },
  ]);

  console.log("Phasenmodelle AVIVA und PADUA erfolgreich geseedet.");
  console.log("Seeding abgeschlossen.");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed-Fehler:", err);
  process.exit(1);
});
