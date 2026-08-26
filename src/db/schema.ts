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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const blockTypEnum = pgEnum("block_typ", ["2er", "4er"]);
export const sozialformEnum = pgEnum("sozialform", ["EA", "PA", "GA", "Plenum"]);

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
}));

// ─── Sequenz ───

export const sequenz = pgTable("sequenz", {
  id: uuid("id").defaultRandom().primaryKey(),
  semesterId: uuid("semester_id")
    .references(() => semester.id, { onDelete: "cascade" })
    .notNull(),
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
