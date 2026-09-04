"use server";

import { db } from "@/db";
import {
  bildungsplan,
  material,
  modul,
  modulBlock,
  modulAuftrag,
  modulAufgabe,
  sequenz,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseSmartlearnStruktur } from "@/lib/smartlearn";
import { normalisiereLaCode } from "@/lib/modulbaum";
import { schaetzeModulZeiten } from "@/lib/zeitschaetzung";
import { extractDokumentText } from "@/lib/dokument-text";
import { importModularPlan } from "./modulplan-actions";
import { readFile } from "fs/promises";
import { join } from "path";
import { aktuellerBenutzer, benutzerId } from "@/lib/dal";

/**
 * Besitzprüfungen. Kindtabellen (modul_block, modul_auftrag, modul_aufgabe)
 * tragen selbst keine `benutzer_id` — sie hängen immer an einem Modul. Wer
 * eine ID von aussen hereinreicht, muss deshalb über den Elternteil geprüft
 * werden, sonst käme man mit einer geratenen UUID an fremde Daten.
 */
async function eigenesModul(modulId: string, bId: string) {
  return db.query.modul.findFirst({
    where: and(eq(modul.id, modulId), eq(modul.benutzerId, bId)),
    columns: { id: true },
  });
}

async function eigenesMaterial(materialId: string, bId: string) {
  return db.query.material.findFirst({
    where: and(eq(material.id, materialId), eq(material.benutzerId, bId)),
    columns: { id: true, titel: true, dateiPfad: true, modulId: true },
  });
}

export async function getCoverageData(klasseId?: string) {
  const bId = await benutzerId();

  // Nur eigene Sequenzen. Die Tabelle ist eine Altlast und praktisch leer —
  // die Einschränkung steht trotzdem hier, damit sie es bleibt.
  const eigeneSequenzen = await db
    .select({ id: sequenz.id })
    .from(sequenz)
    .where(eq(sequenz.benutzerId, bId));

  if (eigeneSequenzen.length === 0) return {};

  const zuordnungen = await db.query.sequenzHandlungskompetenz.findMany({
    where: (sh, { inArray: drin }) =>
      drin(
        sh.sequenzId,
        eigeneSequenzen.map((s) => s.id)
      ),
    with: {
      sequenz: {
        columns: { id: true, titel: true, klasseId: true },
        with: {
          klasse: { columns: { id: true, bezeichnung: true } },
          semester: { columns: { bezeichnung: true } },
        },
      },
      handlungskompetenz: {
        columns: { id: true, kuerzel: true },
      },
    },
  });

  const filtered = klasseId
    ? zuordnungen.filter((z) => z.sequenz.klasse.id === klasseId)
    : zuordnungen;

  const coverageMap = new Map<
    string,
    { hkId: string; kuerzel: string; sequenzen: { id: string; titel: string; klasse: string; semester: string | null }[] }
  >();

  for (const z of filtered) {
    const hkId = z.handlungskompetenz.id;
    if (!coverageMap.has(hkId)) {
      coverageMap.set(hkId, {
        hkId,
        kuerzel: z.handlungskompetenz.kuerzel,
        sequenzen: [],
      });
    }
    coverageMap.get(hkId)!.sequenzen.push({
      id: z.sequenz.id,
      titel: z.sequenz.titel,
      klasse: z.sequenz.klasse.bezeichnung,
      semester: z.sequenz.semester?.bezeichnung ?? null,
    });
  }

  return Object.fromEntries(coverageMap);
}

export async function getKlassenForFilter() {
  const bId = await benutzerId();
  return db.query.klasse.findMany({
    where: (k, { eq: gleich }) => gleich(k.benutzerId, bId),
    orderBy: (k, { asc }) => [asc(k.bezeichnung)],
    columns: { id: true, bezeichnung: true },
  });
}

export async function getModulLookup(): Promise<Record<number, string | null>> {
  const bId = await benutzerId();
  const modulListe = await db.query.modul.findMany({
    where: eq(modul.benutzerId, bId),
    columns: { nummer: true, bezeichnung: true },
  });
  return Object.fromEntries(modulListe.map((m) => [m.nummer, m.bezeichnung]));
}

export async function getModuleGrouped() {
  const bId = await benutzerId();
  const modulListe = await db.query.modul.findMany({
    where: eq(modul.benutzerId, bId),
    orderBy: (m, { asc }) => [asc(m.nummer)],
    with: {
      materialien: {
        columns: { id: true, titel: true, typ: true, dateiPfad: true, url: true, notiz: true, createdAt: true, blockNummer: true },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
      },
      modularPlan: {
        columns: { id: true, kw: true, ziel: true, beschreibung: true, lbHinweis: true, bloecke: true, laCodes: true },
        orderBy: (mp, { asc }) => [asc(mp.kw)],
      },
      // Nur Bezeichnungen, keine Aufgabentexte — die Liste dient der Übersicht.
      bloecke: {
        columns: { id: true, schluessel: true, nummer: true, titel: true, slideMaterialId: true, slideVon: true, slideBis: true },
        orderBy: (b, { asc }) => [asc(b.nummer), asc(b.schluessel)],
        with: {
          auftraege: {
            columns: { id: true, code: true, dauerMinuten: true, dauerQuelle: true },
            orderBy: (a, { asc }) => [asc(a.sortierung)],
            with: {
              aufgaben: {
                columns: { id: true, bezeichnung: true, parentId: true, dauerMinuten: true, dauerQuelle: true },
                orderBy: (a, { asc }) => [asc(a.sortierung)],
              },
            },
          },
        },
      },
    },
  });
  return modulListe;
}

// ─── Modulbaum aus dem Smartlearn-Export ───

type GemerkteDauer = { dauerMinuten: number; dauerQuelle: "ki" | "person" };

/**
 * Die vorhandenen Minutenangaben eines Moduls, adressiert über den fachlichen
 * Schlüssel statt über die UUID — damit sie einen Reimport überleben, bei dem
 * Aufträge und Aufgaben gelöscht und neu angelegt werden.
 */
async function ladeZeitenNachSchluessel(modulId: string): Promise<{
  auftraege: Map<string, GemerkteDauer>;
  aufgaben: Map<string, GemerkteDauer>;
}> {
  const auftraege = new Map<string, GemerkteDauer>();
  const aufgaben = new Map<string, GemerkteDauer>();

  const bloecke = await db.query.modulBlock.findMany({
    where: eq(modulBlock.modulId, modulId),
    columns: { id: true },
    with: {
      auftraege: {
        columns: { code: true, dauerMinuten: true, dauerQuelle: true },
        with: {
          aufgaben: {
            columns: { bezeichnung: true, dauerMinuten: true, dauerQuelle: true },
          },
        },
      },
    },
  });

  for (const b of bloecke) {
    for (const a of b.auftraege) {
      const code = normalisiereLaCode(a.code);
      if (a.dauerMinuten !== null && a.dauerQuelle !== null) {
        auftraege.set(code, {
          dauerMinuten: a.dauerMinuten,
          dauerQuelle: a.dauerQuelle,
        });
      }
      for (const auf of a.aufgaben) {
        if (auf.dauerMinuten === null || auf.dauerQuelle === null) continue;
        aufgaben.set(`${code} · ${auf.bezeichnung}`, {
          dauerMinuten: auf.dauerMinuten,
          dauerQuelle: auf.dauerQuelle,
        });
      }
    }
  }

  return { auftraege, aufgaben };
}

/**
 * Liest Blöcke, Lern- und Arbeitsaufträge und Aufgaben aus dem Smartlearn-HTML
 * und legt sie am Modul ab. Deterministisch, ohne KI.
 *
 * Blöcke werden über (modulId, nummer) aktualisiert statt neu angelegt — sonst
 * ginge die einmal gepflegte Slidezuordnung bei jedem Reimport verloren.
 * Aufträge und Aufgaben darunter werden ersetzt.
 */
export async function importModulBaum(
  modulId: string,
  html: string
): Promise<{
  ok: boolean;
  bloecke: number;
  auftraege: number;
  aufgaben: number;
  error?: string;
}> {
  const leer = { ok: false, bloecke: 0, auftraege: 0, aufgaben: 0 };

  if (!modulId) return { ...leer, error: "Kein Modul gewählt." };

  const bId = await benutzerId();
  if (!(await eigenesModul(modulId, bId))) {
    return { ...leer, error: "Modul nicht gefunden." };
  }

  const geparst = parseSmartlearnStruktur(html);
  if (geparst.length === 0) {
    return {
      ...leer,
      error:
        "Keine Blockstruktur gefunden. Erwartet wird der HTML-Export aus Smartlearn.",
    };
  }

  // Aufträge und Aufgaben werden gleich gelöscht und neu angelegt — die neuen
  // Zeilen tragen neue UUIDs. Gepflegte Minutenangaben gingen dabei verloren,
  // und zwar genau die, die jemand von Hand korrigiert hat. Blöcke haben
  // dasselbe Problem schon einmal gehabt; sie werden deshalb aktualisiert
  // statt neu angelegt, damit die Slidezuordnung überlebt.
  //
  // Gemerkt wird über den fachlichen Schlüssel, nicht über die ID, und der
  // LA-Code wird dabei normalisiert: er ist je nach Export anders
  // abgeschnitten, ein roher Vergleich verlöre die Angabe beim nächsten
  // Import aus einer anderen Quelle.
  const gemerkteZeiten = await ladeZeitenNachSchluessel(modulId);

  let auftraegeGesamt = 0;
  let aufgabenGesamt = 0;

  for (const b of geparst) {
    const [block] = await db
      .insert(modulBlock)
      .values({
        modulId,
        schluessel: b.schluessel,
        nummer: b.nummer,
        titel: b.titel,
      })
      .onConflictDoUpdate({
        target: [modulBlock.modulId, modulBlock.schluessel],
        set: { titel: b.titel, nummer: b.nummer },
      })
      .returning({ id: modulBlock.id });

    await db.delete(modulAuftrag).where(eq(modulAuftrag.blockId, block.id));

    for (const [i, la] of b.auftraege.entries()) {
      const [auftrag] = await db
        .insert(modulAuftrag)
        .values({
          blockId: block.id,
          code: la.code,
          ausgangslage: la.ausgangslage,
          aufgabenstellung: la.aufgabenstellung,
          guetekriterien: la.guetekriterien,
          sortierung: i,
          ...(gemerkteZeiten.auftraege.get(normalisiereLaCode(la.code)) ?? {}),
        })
        .returning({ id: modulAuftrag.id });
      auftraegeGesamt++;

      for (const [j, a] of la.aufgaben.entries()) {
        const [aufgabe] = await db
          .insert(modulAufgabe)
          .values({
            auftragId: auftrag.id,
            bezeichnung: a.bezeichnung,
            text: a.text,
            sortierung: j,
            ...(gemerkteZeiten.aufgaben.get(
              `${normalisiereLaCode(la.code)} · ${a.bezeichnung}`
            ) ?? {}),
          })
          .returning({ id: modulAufgabe.id });
        aufgabenGesamt++;

        if (a.teilaufgaben.length > 0) {
          await db.insert(modulAufgabe).values(
            a.teilaufgaben.map((t, k) => ({
              auftragId: auftrag.id,
              parentId: aufgabe.id,
              bezeichnung: t.bezeichnung,
              text: t.text,
              sortierung: k,
            }))
          );
          aufgabenGesamt += a.teilaufgaben.length;
        }
      }
    }
  }

  // Zeiten schätzen, wo noch keine stehen. Bewusst in try/catch und nach dem
  // Schreiben des Baums: der Import ist deterministisch und darf nicht
  // scheitern, weil die KI gerade nicht antwortet. Ohne Schätzung steht der
  // Baum eben ohne Minuten da — der Ablauf weist das dann als «ohne
  // Zeitangabe» aus, statt eine falsche Summe zu behaupten.
  try {
    await schaetzeModulZeiten(bId, modulId);
  } catch {
    // bewusst geschluckt
  }

  revalidatePath("/bildungsplan");

  return {
    ok: true,
    bloecke: geparst.length,
    auftraege: auftraegeGesamt,
    aufgaben: aufgabenGesamt,
  };
}

/**
 * Zeitschätzung von Hand anstossen — für Module, die schon importiert sind,
 * und wenn beim Import die KI nicht erreichbar war. Fasst gesetzte Werte
 * nicht an.
 */
export async function zeitenSchaetzen(modulId: string) {
  const bId = await benutzerId();
  const ergebnis = await schaetzeModulZeiten(bId, modulId);
  revalidatePath("/bildungsplan");
  return ergebnis;
}

/**
 * Eine Minutenangabe von Hand setzen; `null` löscht sie wieder.
 *
 * Ab jetzt trägt sie `person` und überlebt damit jeden weiteren Schätzlauf —
 * die Korrektur ist eine Aussage der Lehrperson, die Schätzung nur eine
 * Vermutung der KI.
 */
export async function setzeAufgabeDauer(
  art: "aufgabe" | "auftrag" | "block",
  id: string,
  minuten: number | null
) {
  const bId = await benutzerId();

  // Kindtabellen tragen keinen Besitzer — geprüft wird über das Modul, sonst
  // käme man mit einer geratenen UUID an fremde Aufgaben.
  const modulIdVon = await besitzendesModul(art, id);
  if (!modulIdVon || !(await eigenesModul(modulIdVon, bId))) return;

  const wert =
    minuten === null || !Number.isFinite(minuten)
      ? { dauerMinuten: null, dauerQuelle: null }
      : {
          dauerMinuten: Math.min(300, Math.max(1, Math.round(minuten))),
          dauerQuelle: "person" as const,
        };

  const tabelle =
    art === "aufgabe" ? modulAufgabe : art === "auftrag" ? modulAuftrag : modulBlock;
  await db.update(tabelle).set(wert).where(eq(tabelle.id, id));

  revalidatePath("/bildungsplan");
}

/** Zu welchem Modul gehört diese Aufgabe / dieser Auftrag / dieser Block? */
async function besitzendesModul(
  art: "aufgabe" | "auftrag" | "block",
  id: string
): Promise<string | null> {
  if (art === "block") {
    const b = await db.query.modulBlock.findFirst({
      where: eq(modulBlock.id, id),
      columns: { modulId: true },
    });
    return b?.modulId ?? null;
  }

  if (art === "auftrag") {
    const a = await db.query.modulAuftrag.findFirst({
      where: eq(modulAuftrag.id, id),
      columns: { blockId: true },
      with: { block: { columns: { modulId: true } } },
    });
    return a?.block.modulId ?? null;
  }

  const auf = await db.query.modulAufgabe.findFirst({
    where: eq(modulAufgabe.id, id),
    columns: { auftragId: true },
    with: { auftrag: { columns: { blockId: true }, with: { block: { columns: { modulId: true } } } } },
  });
  return auf?.auftrag.block.modulId ?? null;
}

/** Der Baum eines Moduls für die Anzeige. */
export async function getModulBaum(modulId: string) {
  const bId = await benutzerId();
  if (!(await eigenesModul(modulId, bId))) return [];

  return db.query.modulBlock.findMany({
    where: eq(modulBlock.modulId, modulId),
    orderBy: (b, { asc }) => [asc(b.nummer)],
    with: {
      slideMaterial: { columns: { id: true, titel: true } },
      auftraege: {
        orderBy: (a, { asc }) => [asc(a.sortierung)],
        with: {
          aufgaben: { orderBy: (a, { asc }) => [asc(a.sortierung)] },
        },
      },
    },
  });
}

/** Etikett eines Materials setzen: null = ganzes Modul, sonst ein Block. */
export async function setzeMaterialBlock(
  materialId: string,
  blockNummer: number | null
) {
  const bId = await benutzerId();
  await db
    .update(material)
    .set({ blockNummer })
    .where(and(eq(material.id, materialId), eq(material.benutzerId, bId)));
  revalidatePath("/bildungsplan");
}

/** Slidebereich eines Blocks in einer modulweiten Präsentation festhalten. */
export async function setzeBlockSlides(
  blockId: string,
  materialId: string | null,
  von: number | null,
  bis: number | null
) {
  const bId = await benutzerId();

  // Der Block muss zu einem eigenen Modul gehören …
  const eigeneBloecke = await db
    .select({ id: modulBlock.id })
    .from(modulBlock)
    .innerJoin(modul, eq(modulBlock.modulId, modul.id))
    .where(and(eq(modulBlock.id, blockId), eq(modul.benutzerId, bId)));
  if (eigeneBloecke.length === 0) return;

  // … und das verknüpfte Material ebenfalls einem selbst.
  if (materialId && !(await eigenesMaterial(materialId, bId))) return;

  await db
    .update(modulBlock)
    .set({ slideMaterialId: materialId, slideVon: von, slideBis: bis })
    .where(eq(modulBlock.id, blockId));
  revalidatePath("/bildungsplan");
}

/**
 * Liest Modulplan und Aufgabenbaum aus einem bereits hochgeladenen
 * Modul-Material.
 *
 * Ohne das gäbe es zwei getrennte Wege für dieselbe Datei: einmal Drag & Drop
 * in die Materialien, einmal der Modulplan-Dialog. Wer den Export ins Material
 * zieht, erwartet zu Recht, ihn dort auch auswerten zu können.
 */
export async function leseModulAusMaterial(materialId: string): Promise<{
  ok: boolean;
  wochenziele?: number;
  bloecke?: number;
  aufgaben?: number;
  fehler?: string;
}> {
  const bId = await benutzerId();
  const eintrag = await eigenesMaterial(materialId, bId);

  if (!eintrag) return { ok: false, fehler: "Material nicht gefunden." };
  if (!eintrag.modulId) return { ok: false, fehler: "Material hängt an keinem Modul." };
  if (!eintrag.dateiPfad) {
    return { ok: false, fehler: "Zu diesem Eintrag gibt es keine Datei." };
  }

  const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
  let bytes: Buffer;
  try {
    bytes = await readFile(join(UPLOAD_DIR, eintrag.dateiPfad));
  } catch {
    return { ok: false, fehler: "Die Datei konnte nicht gelesen werden." };
  }

  let text: string | null;
  try {
    text = await extractDokumentText(eintrag.titel, bytes);
  } catch (e) {
    return { ok: false, fehler: `Datei konnte nicht gelesen werden: ${e}` };
  }
  if (!text) {
    return {
      ok: false,
      fehler: "Dateityp wird nicht unterstützt. Möglich sind HTML, PDF, JSON, CSV, TXT.",
    };
  }

  // Plan und Baum sind unabhängig voneinander: Modul 219 hat seinen
  // Arbeitsplan nur als Bild im Export, aber einen vollständigen
  // Aufgabenbaum. Ein fehlender Plan darf den Baum nicht verhindern.
  const plan = await importModularPlan(eintrag.modulId, text);

  // Der Aufgabenbaum braucht das rohe HTML — dort trägt die
  // Überschriftenebene die Bedeutung, im geglätteten Text ist sie weg.
  const roh = bytes.toString("utf-8");
  const baum = /<h[1-6][\s>]/i.test(roh)
    ? await importModulBaum(eintrag.modulId, roh)
    : null;

  if (!plan.success && !baum?.ok) {
    return {
      ok: false,
      fehler: plan.error ?? baum?.error ?? "Datei konnte nicht ausgewertet werden.",
    };
  }

  revalidatePath("/bildungsplan");

  return {
    ok: true,
    wochenziele: plan.success ? plan.count : 0,
    bloecke: baum?.ok ? baum.bloecke : 0,
    aufgaben: baum?.ok ? baum.aufgaben : 0,
    fehler: !plan.success ? `Kein Modulplan: ${plan.error}` : undefined,
  };
}

/** Bildungsplan mit Handlungskompetenzbereichen und -kompetenzen. */
export async function getBildungsplanMitHK() {
  const b = await aktuellerBenutzer();

  // Der Plan, den dieses Konto benutzt. Ohne Zuweisung fällt es auf die
  // geteilten Pläne zurück (der offizielle EDB-Plan aus dem Seed).
  const wo = b.bildungsplanId
    ? eq(bildungsplan.id, b.bildungsplanId)
    : isNull(bildungsplan.benutzerId);

  return db.query.bildungsplan.findMany({
    where: wo,
    with: {
      handlungskompetenzbereiche: {
        orderBy: (hkb, { asc }) => [asc(hkb.sortierung)],
        with: {
          handlungskompetenzen: {
            orderBy: (hk, { asc }) => [asc(hk.sortierung)],
          },
        },
      },
    },
  });
}
