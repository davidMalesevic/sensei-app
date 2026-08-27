import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const blockTypEnum = pgEnum("block_typ", ["2er", "4er"]);
export const sozialformEnum = pgEnum("sozialform", ["EA", "PA", "GA", "Plenum"]);
export const ablaufTypEnum = pgEnum("ablauf_typ", [
  "einstieg",
  "praxisbezug",
  "theorie",
  "aufgabe",
  "besprechung",
  "abschluss",
  "frei",
]);

/**
 * Fakten stammen aus dem Material (Aufgabennummern, LA-Codes, Slidebereiche)
 * und dürfen nicht halluziniert werden. Vorschläge kommen von der KI.
 */
export const ablaufQuelleEnum = pgEnum("ablauf_quelle", ["fakt", "vorschlag"]);

export const sequenzStatusEnum = pgEnum("sequenz_status", [
  "leer",
  "entwurf",
  "bestaetigt",
  "gehalten",
]);

// ─── Semester ───

export const semester = pgTable("semester", {
  id: uuid("id").defaultRandom().primaryKey(),
  bezeichnung: varchar("bezeichnung", { length: 100 }).notNull(),
  startDatum: date("start_datum").notNull(),
  endDatum: date("end_datum").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const semesterRelations = relations(semester, ({ many }) => ({
  kalenderEintraege: many(kalenderEintrag),
  semesterKlassen: many(semesterKlasse),
  sequenzen: many(sequenz),
}));

// ─── Kalender-Einträge (Feiertage, Ferien, Prüfungen) ───

export const kalenderEintragTypEnum = pgEnum("kalender_eintrag_typ", [
  "feiertag",
  "ferien",
  "pruefung",
  "sonstiges",
]);

export const kalenderEintrag = pgTable("kalender_eintrag", {
  id: uuid("id").defaultRandom().primaryKey(),
  semesterId: uuid("semester_id")
    .references(() => semester.id, { onDelete: "cascade" })
    .notNull(),
  bezeichnung: varchar("bezeichnung", { length: 200 }).notNull(),
  typ: kalenderEintragTypEnum("typ").notNull(),
  startDatum: date("start_datum").notNull(),
  endDatum: date("end_datum").notNull(),
});

export const kalenderEintragRelations = relations(kalenderEintrag, ({ one }) => ({
  semester: one(semester, {
    fields: [kalenderEintrag.semesterId],
    references: [semester.id],
  }),
}));

// ─── Klasse ───

export const klasse = pgTable("klasse", {
  id: uuid("id").defaultRandom().primaryKey(),
  bezeichnung: varchar("bezeichnung", { length: 100 }).notNull(),
  beruf: varchar("beruf", { length: 200 }).notNull(),
  lehrjahr: integer("lehrjahr").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const klasseRelations = relations(klasse, ({ many }) => ({
  semesterKlassen: many(semesterKlasse),
  sequenzen: many(sequenz),
  pendenzen: many(pendenz),
}));

// ─── Klassen-Alias (Kalenderkürzel → Klasse) ───
//
// Der WebUntis-Export nennt Klassen anders als das Team ("BM1WEDB24z; EDB24z"
// ist intern "MEDB24A"). Die Zuordnung wird beim Stundenplan-Import einmal
// gesetzt und danach wiederverwendet.

export const klasseAlias = pgTable("klasse_alias", {
  id: uuid("id").defaultRandom().primaryKey(),
  kuerzel: varchar("kuerzel", { length: 200 }).notNull().unique(),
  klasseId: uuid("klasse_id")
    .references(() => klasse.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const klasseAliasRelations = relations(klasseAlias, ({ one }) => ({
  klasse: one(klasse, {
    fields: [klasseAlias.klasseId],
    references: [klasse.id],
  }),
}));

// ─── Semester ↔ Klasse (n:m) ───

export const semesterKlasse = pgTable("semester_klasse", {
  id: uuid("id").defaultRandom().primaryKey(),
  semesterId: uuid("semester_id")
    .references(() => semester.id, { onDelete: "cascade" })
    .notNull(),
  klasseId: uuid("klasse_id")
    .references(() => klasse.id, { onDelete: "cascade" })
    .notNull(),
});

export const semesterKlasseRelations = relations(semesterKlasse, ({ one }) => ({
  semester: one(semester, {
    fields: [semesterKlasse.semesterId],
    references: [semester.id],
  }),
  klasse: one(klasse, {
    fields: [semesterKlasse.klasseId],
    references: [klasse.id],
  }),
}));

// ─── Bildungsplan ───

export const bildungsplan = pgTable("bildungsplan", {
  id: uuid("id").defaultRandom().primaryKey(),
  bezeichnung: varchar("bezeichnung", { length: 300 }).notNull(),
  berufsnummer: varchar("berufsnummer", { length: 20 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
});

export const bildungsplanRelations = relations(bildungsplan, ({ many }) => ({
  handlungskompetenzbereiche: many(handlungskompetenzbereich),
}));

// ─── Handlungskompetenzbereich (HKB) ───

export const handlungskompetenzbereich = pgTable("handlungskompetenzbereich", {
  id: uuid("id").defaultRandom().primaryKey(),
  bildungsplanId: uuid("bildungsplan_id")
    .references(() => bildungsplan.id, { onDelete: "cascade" })
    .notNull(),
  kuerzel: varchar("kuerzel", { length: 10 }).notNull(),
  bezeichnung: varchar("bezeichnung", { length: 300 }).notNull(),
  sortierung: integer("sortierung").notNull(),
});

export const handlungskompetenzbereichRelations = relations(
  handlungskompetenzbereich,
  ({ one, many }) => ({
    bildungsplan: one(bildungsplan, {
      fields: [handlungskompetenzbereich.bildungsplanId],
      references: [bildungsplan.id],
    }),
    handlungskompetenzen: many(handlungskompetenz),
  })
);

// ─── Handlungskompetenz (HK) ───

export const handlungskompetenz = pgTable("handlungskompetenz", {
  id: uuid("id").defaultRandom().primaryKey(),
  bereichId: uuid("bereich_id")
    .references(() => handlungskompetenzbereich.id, { onDelete: "cascade" })
    .notNull(),
  kuerzel: varchar("kuerzel", { length: 10 }).notNull(),
  bezeichnung: varchar("bezeichnung", { length: 500 }).notNull(),
  beschreibung: text("beschreibung"),
  moduleBerufsfachschule: jsonb("module_berufsfachschule").$type<number[]>(),
  sortierung: integer("sortierung").notNull(),
});

export const handlungskompetenzRelations = relations(
  handlungskompetenz,
  ({ one, many }) => ({
    bereich: one(handlungskompetenzbereich, {
      fields: [handlungskompetenz.bereichId],
      references: [handlungskompetenzbereich.id],
    }),
    sequenzZuordnungen: many(sequenzHandlungskompetenz),
  })
);

// ─── Phasenmodell (Template) ───

export const phasenmodell = pgTable("phasenmodell", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  beschreibung: text("beschreibung"),
});

export const phasenmodellRelations = relations(phasenmodell, ({ many }) => ({
  phasenTemplates: many(phasenTemplate),
}));

// ─── Phasen-Template ───

export const phasenTemplate = pgTable("phasen_template", {
  id: uuid("id").defaultRandom().primaryKey(),
  phasenmodellId: uuid("phasenmodell_id")
    .references(() => phasenmodell.id, { onDelete: "cascade" })
    .notNull(),
  kuerzel: varchar("kuerzel", { length: 10 }).notNull(),
  bezeichnung: varchar("bezeichnung", { length: 100 }).notNull(),
  zweck: text("zweck"),
  methodenVorschlaege: jsonb("methoden_vorschlaege").$type<string[]>(),
  sortierung: integer("sortierung").notNull(),
  optional: boolean("optional").default(false).notNull(),
});

export const phasenTemplateRelations = relations(phasenTemplate, ({ one }) => ({
  phasenmodell: one(phasenmodell, {
    fields: [phasenTemplate.phasenmodellId],
    references: [phasenmodell.id],
  }),
}));

// ─── Modul ───

export const modul = pgTable("modul", {
  id: uuid("id").defaultRandom().primaryKey(),
  nummer: integer("nummer").notNull().unique(),
  bezeichnung: varchar("bezeichnung", { length: 300 }),
  lehrjahr: integer("lehrjahr"),
});

export const modulRelations = relations(modul, ({ many }) => ({
  sequenzen: many(sequenz),
  materialien: many(material),
  modularPlan: many(modularPlan),
  bloecke: many(modulBlock),
}));

// ─── Modulbaum: Block → Lern- und Arbeitsauftrag → Aufgabe ───
//
// Deterministisch aus dem Smartlearn-HTML gelesen (`src/lib/smartlearn.ts`).
// Zusammen mit `modular_plan.bloecke` gilt: KW + Modul ⇒ Block ⇒ LA ⇒ Aufgaben.
// Original-Bezeichnungen bleiben unverändert.

export const modulBlock = pgTable(
  "modul_block",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modulId: uuid("modul_id")
      .references(() => modul.id, { onDelete: "cascade" })
      .notNull(),
    nummer: integer("nummer").notNull(),
    titel: varchar("titel", { length: 300 }).notNull(),
    /** Slidezuordnung, wenn eine Präsentation fürs ganze Modul gilt. */
    slideMaterialId: uuid("slide_material_id").references(() => material.id, {
      onDelete: "set null",
    }),
    slideVon: integer("slide_von"),
    slideBis: integer("slide_bis"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.modulId, t.nummer)]
);

export const modulBlockRelations = relations(modulBlock, ({ one, many }) => ({
  modul: one(modul, {
    fields: [modulBlock.modulId],
    references: [modul.id],
  }),
  slideMaterial: one(material, {
    fields: [modulBlock.slideMaterialId],
    references: [material.id],
  }),
  auftraege: many(modulAuftrag),
}));

export const modulAuftrag = pgTable(
  "modul_auftrag",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .references(() => modulBlock.id, { onDelete: "cascade" })
      .notNull(),
    code: varchar("code", { length: 200 }).notNull(),
    ausgangslage: text("ausgangslage"),
    aufgabenstellung: text("aufgabenstellung"),
    guetekriterien: text("guetekriterien"),
    sortierung: integer("sortierung").default(0).notNull(),
  },
  (t) => [unique().on(t.blockId, t.code)]
);

export const modulAuftragRelations = relations(modulAuftrag, ({ one, many }) => ({
  block: one(modulBlock, {
    fields: [modulAuftrag.blockId],
    references: [modulBlock.id],
  }),
  aufgaben: many(modulAufgabe),
}));

export const modulAufgabe = pgTable("modul_aufgabe", {
  id: uuid("id").defaultRandom().primaryKey(),
  auftragId: uuid("auftrag_id")
    .references(() => modulAuftrag.id, { onDelete: "cascade" })
    .notNull(),
  /** Gesetzt bei Teilaufgaben; zeigt auf die übergeordnete Aufgabe. */
  parentId: uuid("parent_id"),
  bezeichnung: varchar("bezeichnung", { length: 200 }).notNull(),
  text: text("text"),
  sortierung: integer("sortierung").default(0).notNull(),
});

export const modulAufgabeRelations = relations(modulAufgabe, ({ one }) => ({
  auftrag: one(modulAuftrag, {
    fields: [modulAufgabe.auftragId],
    references: [modulAuftrag.id],
  }),
}));

// ─── Sequenz ───

export const sequenz = pgTable("sequenz", {
  id: uuid("id").defaultRandom().primaryKey(),
  semesterId: uuid("semester_id").references(() => semester.id, {
    onDelete: "cascade",
  }),
  klasseId: uuid("klasse_id")
    .references(() => klasse.id, { onDelete: "cascade" })
    .notNull(),
  modulId: uuid("modul_id").references(() => modul.id),
  titel: varchar("titel", { length: 300 }).notNull(),
  beschreibung: text("beschreibung"),
  praxisbezug: text("praxisbezug"),
  uebergabenotiz: text("uebergabenotiz"),
  cockpitNotiz: text("cockpit_notiz"),
  startDatum: date("start_datum"),
  endDatum: date("end_datum"),
  // Aus dem Stundenplan-Import (.ics). kalenderKurs ist der UID-Präfix des
  // WebUntis-Kurses und zusammen mit startDatum der Idempotenz-Schlüssel.
  kalenderKurs: varchar("kalender_kurs", { length: 50 }),
  startZeit: varchar("start_zeit", { length: 5 }),
  endZeit: varchar("end_zeit", { length: 5 }),
  lektionen: integer("lektionen"),
  raum: varchar("raum", { length: 50 }),
  status: sequenzStatusEnum("status").default("leer").notNull(),
  // Übertrag: die einzige Eingabe nach der Lektion. «Bis wo sind wir
  // gekommen» ist nicht ableitbar — die App kann nichts wissen, was nicht
  // getippt wird.
  uebertrag: text("uebertrag"),
  /** Abgehakte Aufgaben, mit ihrer Original-Bezeichnung. */
  uebertragErledigt: text("uebertrag_erledigt").array(),
  uebertragSlideBis: integer("uebertrag_slide_bis"),
  keinUebertrag: boolean("kein_uebertrag").default(false).notNull(),
  uebertragAm: timestamp("uebertrag_am"),
  entwurfAm: timestamp("entwurf_am"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sequenzRelations = relations(sequenz, ({ one, many }) => ({
  semester: one(semester, {
    fields: [sequenz.semesterId],
    references: [semester.id],
  }),
  klasse: one(klasse, {
    fields: [sequenz.klasseId],
    references: [klasse.id],
  }),
  modul: one(modul, {
    fields: [sequenz.modulId],
    references: [modul.id],
  }),
  lektionsbloecke: many(lektionsblock),
  handlungskompetenzen: many(sequenzHandlungskompetenz),
  materialien: many(material),
  anker: many(sequenzAnker),
  ablauf: many(sequenzAblauf),
}));

// ─── Ablauf ───
//
// Die 8–10 Zeilen, die im Unterricht zählen. Ersetzt Lektionsblöcke und
// Phasen als Arbeitsergebnis (`erstellungsprozess.md`, Abschnitt 5.2).

export const sequenzAblauf = pgTable("sequenz_ablauf", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenzId: uuid("sequenz_id")
    .references(() => sequenz.id, { onDelete: "cascade" })
    .notNull(),
  sortierung: integer("sortierung").default(0).notNull(),
  typ: ablaufTypEnum("typ").notNull(),
  quelle: ablaufQuelleEnum("quelle").default("vorschlag").notNull(),
  titel: varchar("titel", { length: 300 }).notNull(),
  text: text("text"),
  /** Herkunft eines Faktums: LA-Code, Aufgaben-Bezeichnung, Material, Seiten. */
  refCode: varchar("ref_code", { length: 200 }),
  refAufgabe: varchar("ref_aufgabe", { length: 200 }),
  refMaterialId: uuid("ref_material_id").references(() => material.id, {
    onDelete: "set null",
  }),
  refSeiteVon: integer("ref_seite_von"),
  refSeiteBis: integer("ref_seite_bis"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sequenzAblaufRelations = relations(sequenzAblauf, ({ one }) => ({
  sequenz: one(sequenz, {
    fields: [sequenzAblauf.sequenzId],
    references: [sequenz.id],
  }),
  refMaterial: one(material, {
    fields: [sequenzAblauf.refMaterialId],
    references: [material.id],
  }),
}));

// ─── Sequenz ↔ Handlungskompetenz (n:m) ───

export const sequenzHandlungskompetenz = pgTable("sequenz_handlungskompetenz", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenzId: uuid("sequenz_id")
    .references(() => sequenz.id, { onDelete: "cascade" })
    .notNull(),
  handlungskompetenzId: uuid("handlungskompetenz_id")
    .references(() => handlungskompetenz.id, { onDelete: "cascade" })
    .notNull(),
});

export const sequenzHandlungskompetenzRelations = relations(
  sequenzHandlungskompetenz,
  ({ one }) => ({
    sequenz: one(sequenz, {
      fields: [sequenzHandlungskompetenz.sequenzId],
      references: [sequenz.id],
    }),
    handlungskompetenz: one(handlungskompetenz, {
      fields: [sequenzHandlungskompetenz.handlungskompetenzId],
      references: [handlungskompetenz.id],
    }),
  })
);

// ─── Lektionsblock ───

export const lektionsblock = pgTable("lektionsblock", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenzId: uuid("sequenz_id")
    .references(() => sequenz.id, { onDelete: "cascade" })
    .notNull(),
  datum: date("datum"),
  blockTyp: blockTypEnum("block_typ").notNull(),
  phasenmodellId: uuid("phasenmodell_id").references(() => phasenmodell.id),
  thema: varchar("thema", { length: 300 }),
  sortierung: integer("sortierung").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lektionsblockRelations = relations(lektionsblock, ({ one, many }) => ({
  sequenz: one(sequenz, {
    fields: [lektionsblock.sequenzId],
    references: [sequenz.id],
  }),
  phasenmodell: one(phasenmodell, {
    fields: [lektionsblock.phasenmodellId],
    references: [phasenmodell.id],
  }),
  phasen: many(phase),
  materialien: many(material),
}));

// ─── Phase ───

export const phase = pgTable("phase", {
  id: uuid("id").defaultRandom().primaryKey(),
  lektionsblockId: uuid("lektionsblock_id")
    .references(() => lektionsblock.id, { onDelete: "cascade" })
    .notNull(),
  bezeichnung: varchar("bezeichnung", { length: 100 }).notNull(),
  beschreibung: text("beschreibung"),
  dauerMinuten: integer("dauer_minuten"),
  sozialform: sozialformEnum("sozialform"),
  methode: varchar("methode", { length: 200 }),
  sortierung: integer("sortierung").notNull(),
});

export const phaseRelations = relations(phase, ({ one, many }) => ({
  lektionsblock: one(lektionsblock, {
    fields: [phase.lektionsblockId],
    references: [lektionsblock.id],
  }),
  materialien: many(material),
}));

// ─── Material ───

export const materialTypEnum = pgEnum("material_typ", [
  "arbeitsblatt",
  "praesentation",
  "link",
  "video",
  "dokument",
  "notiz",
  "sonstiges",
]);

export const material = pgTable("material", {
  id: uuid("id").defaultRandom().primaryKey(),
  titel: varchar("titel", { length: 300 }).notNull(),
  typ: materialTypEnum("typ").notNull(),
  url: text("url"),
  notiz: text("notiz"),
  sequenzId: uuid("sequenz_id").references(() => sequenz.id, { onDelete: "cascade" }),
  lektionsblockId: uuid("lektionsblock_id").references(() => lektionsblock.id, {
    onDelete: "cascade",
  }),
  phaseId: uuid("phase_id").references(() => phase.id, { onDelete: "cascade" }),
  modulId: uuid("modul_id").references(() => modul.id, { onDelete: "cascade" }),
  /** Etikett: null = gilt fürs ganze Modul, sonst genau dieser Block. */
  blockNummer: integer("block_nummer"),
  dateiPfad: text("datei_pfad"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const materialRelations = relations(material, ({ one, many }) => ({
  sequenz: one(sequenz, {
    fields: [material.sequenzId],
    references: [sequenz.id],
  }),
  lektionsblock: one(lektionsblock, {
    fields: [material.lektionsblockId],
    references: [lektionsblock.id],
  }),
  phase: one(phase, {
    fields: [material.phaseId],
    references: [phase.id],
  }),
  modul: one(modul, {
    fields: [material.modulId],
    references: [modul.id],
  }),
  tasks: many(materialTask),
}));

// ─── Modulplan (Wochenziele pro Modul) ───

export const modularPlan = pgTable("modular_plan", {
  id: uuid("id").defaultRandom().primaryKey(),
  modulId: uuid("modul_id")
    .references(() => modul.id, { onDelete: "cascade" })
    .notNull(),
  kw: integer("kw").notNull(),
  ziel: varchar("ziel", { length: 300 }).notNull(),
  beschreibung: text("beschreibung"),
  /** Blocknummern dieser Woche — eine Woche kann zwei Blöcke berühren. */
  bloecke: integer("bloecke").array(),
  laCodes: text("la_codes").array(),
  /** Leistungsbeurteilung dieser Woche (aus «LB:»-Zeilen des Modulplans). */
  lbHinweis: text("lb_hinweis"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const modularPlanRelations = relations(modularPlan, ({ one }) => ({
  modul: one(modul, {
    fields: [modularPlan.modulId],
    references: [modul.id],
  }),
}));

// ─── Material-Task (aus Material extrahierte Schüler-Aufgaben) ───

export const materialTask = pgTable("material_task", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id")
    .references(() => material.id, { onDelete: "cascade" })
    .notNull(),
  /** Original-Bezeichnung aus der Quelle, z.B. «Aufgabe 1 / Teilaufgabe 2». */
  bezeichnung: varchar("bezeichnung", { length: 200 }),
  taskText: text("task_text").notNull(),
  referenz: varchar("referenz", { length: 200 }),
  sortierung: integer("sortierung").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const materialTaskRelations = relations(materialTask, ({ one }) => ({
  material: one(material, {
    fields: [materialTask.materialId],
    references: [material.id],
  }),
}));

// ─── Pendenz (offene Punkte pro Klasse) ───

export const pendenz = pgTable("pendenz", {
  id: uuid("id").defaultRandom().primaryKey(),
  klasseId: uuid("klasse_id")
    .references(() => klasse.id, { onDelete: "cascade" })
    .notNull(),
  text: text("text").notNull(),
  erledigt: boolean("erledigt").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pendenzRelations = relations(pendenz, ({ one }) => ({
  klasse: one(klasse, {
    fields: [pendenz.klasseId],
    references: [klasse.id],
  }),
}));

// ─── Sequenz-Anker (Cockpit: Orientierungspunkte statt Phasenplan) ───

export const ankerArtEnum = pgEnum("anker_art", [
  "einstieg",
  "repetition",
  "aufgabe",
  "referenz",
  "modus",
  "notiz",
]);

export const sequenzAnker = pgTable("sequenz_anker", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenzId: uuid("sequenz_id")
    .references(() => sequenz.id, { onDelete: "cascade" })
    .notNull(),
  art: ankerArtEnum("art").notNull(),
  titel: varchar("titel", { length: 300 }).notNull(),
  text: text("text"),
  sortierung: integer("sortierung").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sequenzAnkerRelations = relations(sequenzAnker, ({ one }) => ({
  sequenz: one(sequenz, {
    fields: [sequenzAnker.sequenzId],
    references: [sequenz.id],
  }),
}));
