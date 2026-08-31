import {
  type AnyPgColumn,
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


// ─── Benutzer & Session ───
//
// Eigenes Login statt eines fremden Dienstes — dieselbe Bauart wie die
// Menüplanungs-App: Passwort-Hash in `benutzer`, ein zufälliges Token in
// `session`, das als httpOnly-Cookie beim Browser liegt.
//
// `bildungsplanId` hält fest, mit welchem Bildungsplan diese Person arbeitet:
// entweder ein geteilter (offizieller EDB-Plan, `bildungsplan.benutzerId IS
// NULL`) oder ein eigener.

export const benutzer = pgTable("benutzer", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Immer kleingeschrieben gespeichert — die Eindeutigkeit ignoriert Gross/Klein. */
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  passwortHash: text("passwort_hash").notNull(),
  /** Darf die Verwaltung sehen. Der erste angelegte Benutzer ist Admin. */
  istAdmin: boolean("ist_admin").default(false).notNull(),
  /** Für die Verwaltungsübersicht — wird bei jeder Anmeldung gesetzt. */
  letzteAnmeldung: timestamp("letzte_anmeldung"),

  // ─ Vorbereitungsdurchgang (früher fix «Nachtlauf um 03:00 für alle») ─
  //
  // Der Cron auf dem Server läuft stündlich und fragt für jedes Konto, ob
  // jetzt sein Zeitpunkt ist. Wann jemand vorbereitet, ist eine persönliche
  // Gewohnheit — die Mittwochnacht passt nicht für alle.
  vorbereitungAktiv: boolean("vorbereitung_aktiv").default(true).notNull(),
  /** 0 = Sonntag … 6 = Samstag. NULL = jeden Tag. */
  vorbereitungTag: integer("vorbereitung_tag"),
  /** Stunde in Schweizer Zeit, 0–23. */
  vorbereitungStunde: integer("vorbereitung_stunde").default(3).notNull(),
  /** Wie weit im Voraus geplant wird. */
  vorbereitungTageVoraus: integer("vorbereitung_tage_voraus")
    .default(10)
    .notNull(),
  // Zirkelbezug zu `bildungsplan` — Drizzle braucht dafür die explizite
  // Rückgabeannotation, sonst kann TypeScript den Typ nicht auflösen.
  bildungsplanId: uuid("bildungsplan_id").references(
    (): AnyPgColumn => bildungsplan.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const benutzerRelations = relations(benutzer, ({ one, many }) => ({
  bildungsplan: one(bildungsplan, {
    fields: [benutzer.bildungsplanId],
    references: [bildungsplan.id],
  }),
  sessions: many(session),
  resets: many(passwortReset),
}));

export const session = pgTable("session", {
  /** Zufälliges Token, 32 Byte urlsafe — steht so im Cookie. */
  token: text("token").primaryKey(),
  benutzerId: uuid("benutzer_id")
    .references(() => benutzer.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const sessionRelations = relations(session, ({ one }) => ({
  benutzer: one(benutzer, {
    fields: [session.benutzerId],
    references: [benutzer.id],
  }),
}));

/**
 * Einmal-Link zum Setzen eines neuen Passworts.
 *
 * Gespeichert wird nur der SHA-256-Hash des Tokens: wer die Datenbank liest,
 * bekommt damit keinen funktionierenden Link. Der Klartext existiert genau
 * einmal — in dem Link, den der Admin weitergibt.
 */
export const passwortReset = pgTable("passwort_reset", {
  tokenHash: text("token_hash").primaryKey(),
  benutzerId: uuid("benutzer_id")
    .references(() => benutzer.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  /** Gesetzt, sobald der Link benutzt wurde — danach ist er tot. */
  verwendetAm: timestamp("verwendet_am"),
});

export const passwortResetRelations = relations(passwortReset, ({ one }) => ({
  benutzer: one(benutzer, {
    fields: [passwortReset.benutzerId],
    references: [benutzer.id],
  }),
}));

/**
 * Einladung: ein Einmal-Link pro Person statt eines gemeinsamen Codes.
 *
 * Ein geteiltes Geheimnis läuft nie ab, lässt sich nicht einzeln zurücknehmen
 * und wandert weiter. Eine Einladung gehört genau einer E-Mail, verfällt nach
 * sieben Tagen und ist danach — oder nach der Verwendung — tot.
 *
 * Wie beim Passwort-Reset steht nur der SHA-256-Hash in der Datenbank.
 */
export const einladung = pgTable("einladung", {
  tokenHash: text("token_hash").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  erstelltVon: uuid("erstellt_von")
    .references(() => benutzer.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verwendetAm: timestamp("verwendet_am"),
  /** Das Konto, das daraus entstanden ist. */
  benutzerId: uuid("benutzer_id").references((): AnyPgColumn => benutzer.id, {
    onDelete: "set null",
  }),
});

export const einladungRelations = relations(einladung, ({ one }) => ({
  ersteller: one(benutzer, {
    fields: [einladung.erstelltVon],
    references: [benutzer.id],
  }),
}));

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
  benutzerId: uuid("benutzer_id")
    .references(() => benutzer.id, { onDelete: "cascade" })
    .notNull(),
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

export const klasseAlias = pgTable(
  "klasse_alias",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    benutzerId: uuid("benutzer_id")
      .references(() => benutzer.id, { onDelete: "cascade" })
      .notNull(),
    kuerzel: varchar("kuerzel", { length: 200 }).notNull(),
    klasseId: uuid("klasse_id")
      .references(() => klasse.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // Früher global eindeutig. Zwei Lehrpersonen können dasselbe
  // Kalenderkürzel führen — eindeutig ist es nur innerhalb eines Kontos.
  (t) => [unique().on(t.benutzerId, t.kuerzel)]
);

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
  /**
   * NULL = geteilter Plan, den alle sehen (der offizielle EDB-Bildungsplan
   * aus dem Seed). Sonst gehört der Plan genau dieser Person.
   */
  benutzerId: uuid("benutzer_id").references((): AnyPgColumn => benutzer.id, {
    onDelete: "cascade",
  }),
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

export const modul = pgTable(
  "modul",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    benutzerId: uuid("benutzer_id")
      .references(() => benutzer.id, { onDelete: "cascade" })
      .notNull(),
    nummer: integer("nummer").notNull(),
    bezeichnung: varchar("bezeichnung", { length: 300 }),
    lehrjahr: integer("lehrjahr"),
  },
  // Modul 119 gibt es bei jeder Lehrperson — mit eigenem Modulplan,
  // eigenem Aufgabenbaum und eigenem Material.
  (t) => [unique().on(t.benutzerId, t.nummer)]
);

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
    /** Normalisiert: «1», «2», «A» — die Exporte benennen Blöcke verschieden. */
    schluessel: varchar("schluessel", { length: 10 }).notNull(),
    /** Reihenfolge; bei Buchstaben die Position im Alphabet. */
    nummer: integer("nummer"),
    titel: varchar("titel", { length: 300 }).notNull(),
    /** Slidezuordnung, wenn eine Präsentation fürs ganze Modul gilt. */
    slideMaterialId: uuid("slide_material_id").references(() => material.id, {
      onDelete: "set null",
    }),
    slideVon: integer("slide_von"),
    slideBis: integer("slide_bis"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.modulId, t.schluessel)]
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
  benutzerId: uuid("benutzer_id")
    .references(() => benutzer.id, { onDelete: "cascade" })
    .notNull(),
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
  /**
   * Dasselbe Modul läuft mit mehreren Klassen. Der Ablauf wird einmal geplant
   * und übernommen; Fortschritt und Notizen bleiben pro Klasse getrennt.
   */
  uebernommenVon: uuid("uebernommen_von"),
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
  benutzerId: uuid("benutzer_id")
    .references(() => benutzer.id, { onDelete: "cascade" })
    .notNull(),
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
  bloecke: text("bloecke").array(),
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
  benutzerId: uuid("benutzer_id")
    .references(() => benutzer.id, { onDelete: "cascade" })
    .notNull(),
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

// ─── Smartlearn-Resultate ─────────────────────────────────────────────────
//
// Bewusst **eigene Tabellen ohne Eingriff in bestehende**: das Auswerten von
// Lernendenabgaben ist ein Versuch. Taugt es nichts, genügt ein DROP der vier
// Tabellen (`src/db/drop-resultate.ts`) und nichts anderes merkt es. Die
// Verbindung zum Modulbaum und zum Ablauf läuft nur lesend über den LA-Code.
//
// Ein Import ist eine **Momentaufnahme**. Der Export trägt keine Zeitstempel
// pro Antwort — wann etwas gelöst wurde, ergibt sich erst aus der Differenz
// zweier Importe. Deshalb wird nie überschrieben, sondern angehängt.

export const resultatImport = pgTable("resultat_import", {
  id: uuid("id").defaultRandom().primaryKey(),
  benutzerId: uuid("benutzer_id")
    .references(() => benutzer.id, { onDelete: "cascade" })
    .notNull(),
  modulId: uuid("modul_id")
    .references(() => modul.id, { onDelete: "cascade" })
    .notNull(),
  /** Optional — die Durchführung nennt das Kürzel, die Klasse muss es nicht geben. */
  klasseId: uuid("klasse_id").references(() => klasse.id, { onDelete: "set null" }),
  /** `M278_EDB25B_Q1` */
  durchfuehrung: varchar("durchfuehrung", { length: 200 }),
  klassenKuerzel: varchar("klassen_kuerzel", { length: 100 }),
  /** Datum aus dem Export, nicht der Zeitpunkt des Hochladens. */
  exportDatum: varchar("export_datum", { length: 20 }),
  dateiname: varchar("dateiname", { length: 300 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const resultatImportRelations = relations(resultatImport, ({ one, many }) => ({
  modul: one(modul, { fields: [resultatImport.modulId], references: [modul.id] }),
  klasse: one(klasse, { fields: [resultatImport.klasseId], references: [klasse.id] }),
  personen: many(resultatPerson),
  aufgaben: many(resultatAufgabe),
}));

export const resultatPerson = pgTable("resultat_person", {
  id: uuid("id").defaultRandom().primaryKey(),
  importId: uuid("import_id")
    .references(() => resultatImport.id, { onDelete: "cascade" })
    .notNull(),
  nachname: varchar("nachname", { length: 200 }).notNull(),
  vorname: varchar("vorname", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  /**
   * Lehrpersonen stehen im Export zwischen den Lernenden und tragen die
   * Musterlösung in ihren Zellen. Ohne diese Kennzeichnung meldet jede
   * Duplikatsprüfung als Erstes sie.
   */
  istLehrperson: boolean("ist_lehrperson").default(false).notNull(),
});

export const resultatPersonRelations = relations(resultatPerson, ({ one, many }) => ({
  import: one(resultatImport, {
    fields: [resultatPerson.importId],
    references: [resultatImport.id],
  }),
  abgaben: many(resultatAbgabe),
}));

export const resultatAufgabe = pgTable(
  "resultat_aufgabe",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importId: uuid("import_id")
      .references(() => resultatImport.id, { onDelete: "cascade" })
      .notNull(),
    /** Spaltenbuchstabe im Export, z.B. `AG` — der Schlüssel innerhalb eines Imports. */
    spalte: varchar("spalte", { length: 10 }).notNull(),
    /** Verknüpft lesend mit `modul_auftrag.code`. */
    laCode: varchar("la_code", { length: 300 }),
    /** So, wie der Export sie nennt: `2`. Der Ablauf schreibt `Aufgabe 2 – …`. */
    aufgabeNr: varchar("aufgabe_nr", { length: 50 }),
    art: varchar("art", { length: 50 }).notNull(),
    frage: text("frage"),
    musterloesung: text("musterloesung"),
  },
  (t) => [unique().on(t.importId, t.spalte)]
);

export const resultatAufgabeRelations = relations(resultatAufgabe, ({ one, many }) => ({
  import: one(resultatImport, {
    fields: [resultatAufgabe.importId],
    references: [resultatImport.id],
  }),
  abgaben: many(resultatAbgabe),
}));

export const resultatAbgabe = pgTable(
  "resultat_abgabe",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .references(() => resultatPerson.id, { onDelete: "cascade" })
      .notNull(),
    aufgabeId: uuid("aufgabe_id")
      .references(() => resultatAufgabe.id, { onDelete: "cascade" })
      .notNull(),
    text: text("text").notNull(),
    /** Text ohne die vorbefüllte Vorlage — Grundlage jedes Vergleichs. */
    textBereinigt: text("text_bereinigt").notNull(),
  },
  (t) => [unique().on(t.personId, t.aufgabeId)]
);

export const resultatAbgabeRelations = relations(resultatAbgabe, ({ one }) => ({
  person: one(resultatPerson, {
    fields: [resultatAbgabe.personId],
    references: [resultatPerson.id],
  }),
  aufgabe: one(resultatAufgabe, {
    fields: [resultatAbgabe.aufgabeId],
    references: [resultatAufgabe.id],
  }),
}));
