import { SequenzForm } from "../sequenz-form";
import {
  createSequenz,
  getSemesterList,
  getKlassenList,
  getBildungsplanMitHK,
  getModule,
  getPhasenmodelle,
} from "../actions";

export default async function NeueSequenzPage() {
  const [semesterList, klassenList, bildungsplaene, moduleList, phasenmodelle] =
    await Promise.all([
      getSemesterList(),
      getKlassenList(),
      getBildungsplanMitHK(),
      getModule(),
      getPhasenmodelle(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Neue Sequenz</h1>
        <p className="text-muted-foreground mt-1">
          Erstelle eine neue Unterrichtssequenz.
        </p>
      </div>
      <SequenzForm
        action={createSequenz}
        semesterList={semesterList}
        klassenList={klassenList}
        moduleList={moduleList}
        bildungsplaene={bildungsplaene}
        phasenmodelle={phasenmodelle}
      />
    </div>
  );
}
