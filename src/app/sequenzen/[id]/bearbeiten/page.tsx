import { notFound } from "next/navigation";
import { SequenzForm } from "../../sequenz-form";
import {
  getSequenzById,
  updateSequenz,
  getSemesterList,
  getKlassenList,
  getBildungsplanMitHK,
  getModule,
} from "../../actions";

export default async function SequenzBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [seq, semesterList, klassenList, bildungsplaene, moduleList] =
    await Promise.all([
      getSequenzById(id),
      getSemesterList(),
      getKlassenList(),
      getBildungsplanMitHK(),
      getModule(),
    ]);

  if (!seq) return notFound();

  const updateAction = updateSequenz.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Sequenz bearbeiten
        </h1>
        <p className="text-muted-foreground mt-1">{seq.titel}</p>
      </div>
      <SequenzForm
        sequenzData={{
          id: seq.id,
          titel: seq.titel,
          beschreibung: seq.beschreibung,
          praxisbezug: seq.praxisbezug,
          semesterId: seq.semesterId ?? "",
          klasseId: seq.klasseId,
          modulId: seq.modulId,
          startDatum: seq.startDatum,
          selectedHKIds: seq.handlungskompetenzen.map(
            (shk) => shk.handlungskompetenzId
          ),
        }}
        action={updateAction}
        semesterList={semesterList}
        klassenList={klassenList}
        moduleList={moduleList}
        bildungsplaene={bildungsplaene}
      />
    </div>
  );
}
