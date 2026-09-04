"use server";

import { db } from "@/db";
import { sequenz, klasse, modul } from "@/db/schema";
import { and, desc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { schweizerHeute } from "@/lib/zeit";
import { aktuelleSession, benutzerId } from "@/lib/dal";
import { holeVorherigenUebertrag } from "@/lib/uebertrag";
import { getOffenenStoff } from "@/lib/rueckstand";
import { markenAusStoff } from "@/lib/modulbaum";
import { getKWFromDateString } from "@/lib/kw";

/**
 * Übertrag nach der Lektion: bis wo sind wir gekommen, was fliesst in die
 * Planung der Folgewoche ein. Siehe `erstellungsprozess.md`, Abschnitt 6.4.
 *
 * Bewusst manuell — die App kann nichts wissen, was nicht getippt wird.
 */
export async function speichereUebertrag(sequenzId: string, formData: FormData) {
  const bId = await benutzerId();
  const text = ((formData.get("uebertrag") as string) ?? "").trim();
  const erledigt = (formData.getAll("erledigt") as string[]).filter(Boolean);
  const slideBisRoh = ((formData.get("slideBis") as string) ?? "").trim();
  const slideBis = slideBisRoh ? Number(slideBisRoh) : null;

  await db
    .update(sequenz)
    .set({
      uebertrag: text || null,
      uebertragErledigt: erledigt.length > 0 ? erledigt : null,
      uebertragSlideBis:
        slideBis !== null && Number.isFinite(slideBis) ? slideBis : null,
      keinUebertrag: false,
      uebertragAm: new Date(),
      status: "gehalten",
      updatedAt: new Date(),
    })
    .where(and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)));

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");
  revalidatePath("/");
}

/**
 * «Kein Übertrag» — alles lief wie geplant, alles ist erledigt, nichts ist für
 * nächste Woche vorzumerken.
 *
 * Das ist keine Formalie mehr, mit der man den roten Punkt loswird: die Woche
 * wird damit **abgeschlossen**, und ihre Aufgaben kommen nie wieder. Deshalb
 * werden sie hier auch tatsächlich hingeschrieben, statt die Bedeutung des
 * Flags später zu rechnen — ein Modulplan-Reimport könnte sonst nachträglich
 * verschieben, was diese Woche eigentlich umfasste.
 *
 * Der Rückstand gehört dazu: er stand an diesem Tag im Ablauf, «alles wie
 * geplant» schliesst ihn also ein.
 */
export async function keinUebertragSetzen(sequenzId: string) {
  const bId = await benutzerId();

  const seq = await db.query.sequenz.findFirst({
    where: and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)),
    columns: { klasseId: true, modulId: true, startDatum: true },
  });
  if (!seq) return;

  const offen = await getOffenenStoff(
    bId,
    seq.klasseId,
    seq.modulId,
    getKWFromDateString(seq.startDatum),
    seq.startDatum
  );

  const marken = [
    ...offen.rueckstand.flatMap((r) =>
      markenAusStoff({
        kw: r.kw,
        ziel: r.ziel,
        lbHinweis: null,
        bloecke: r.bloecke,
        ohneModulplan: false,
      })
    ),
    ...(offen.diese ? markenAusStoff(offen.diese) : []),
  ];

  await db
    .update(sequenz)
    .set({
      uebertragErledigt: marken.length > 0 ? [...new Set(marken)] : null,
      keinUebertrag: true,
      uebertragAm: new Date(),
      status: "gehalten",
      updatedAt: new Date(),
    })
    .where(and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)));

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");
  revalidatePath("/");
}

/** Einen gesetzten Übertrag wieder öffnen. */
export async function uebertragZuruecksetzen(sequenzId: string) {
  const bId = await benutzerId();
  await db
    .update(sequenz)
    .set({
      uebertrag: null,
      uebertragErledigt: null,
      uebertragSlideBis: null,
      keinUebertrag: false,
      uebertragAm: null,
      updatedAt: new Date(),
    })
    .where(and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)));

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");
  revalidatePath("/");
}

/**
 * Sequenzen, die stattgefunden haben, aber keinen Übertrag tragen — der rote
 * Punkt. Ohne sie fehlt der Folgewoche der Ausgangspunkt.
 */
export async function getOffeneUebertraege() {
  // Wird im Root-Layout aufgerufen, auch auf der Anmeldeseite: hier darf
  // nicht umgeleitet werden, sonst dreht sich die Weiterleitung im Kreis.
  const angemeldet = await aktuelleSession();
  if (!angemeldet) return [];

  const heute = schweizerHeute();

  return db
    .select({
      id: sequenz.id,
      startDatum: sequenz.startDatum,
      startZeit: sequenz.startZeit,
      klasse: klasse.bezeichnung,
      modulNummer: modul.nummer,
    })
    .from(sequenz)
    .innerJoin(klasse, eq(sequenz.klasseId, klasse.id))
    .leftJoin(modul, eq(sequenz.modulId, modul.id))
    .where(
      and(
        eq(sequenz.benutzerId, angemeldet.id),
        isNotNull(sequenz.kalenderKurs),
        lt(sequenz.startDatum, heute),
        eq(sequenz.keinUebertrag, false),
        // Gespeichert zählt, nicht getippt — siehe `uebertrag-section.tsx`.
        isNull(sequenz.uebertragAm)
      )
    )
    .orderBy(desc(sequenz.startDatum), desc(sequenz.startZeit));
}

/**
 * Der letzte Übertrag derselben Klasse im selben Modul vor dieser Sequenz.
 * Die Abfrage liegt in `src/lib/uebertrag.ts` — hier nur die Session.
 */
export async function getVorherigenUebertrag(
  klasseId: string,
  modulId: string | null,
  datum: string | null,
  currentSequenzId: string
) {
  const bId = await benutzerId();
  return holeVorherigenUebertrag(bId, klasseId, modulId, datum, currentSequenzId);
}

/**
 * Was für diese Klasse in diesem Modul noch offen ist — laufende Woche plus
 * Rückstand. Die Rechnung liegt in `src/lib/rueckstand.ts`, hier nur die
 * Session.
 */
export async function getOffenenStoffFuerSequenz(
  klasseId: string,
  modulId: string | null,
  datum: string | null
) {
  const bId = await benutzerId();
  return getOffenenStoff(
    bId,
    klasseId,
    modulId,
    getKWFromDateString(datum),
    datum
  );
}
