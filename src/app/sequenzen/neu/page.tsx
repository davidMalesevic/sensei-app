import { SequenzForm } from "../sequenz-form";
import {
  createSequenz,
  getSemesterList,
  getKlassenList,
  getBildungsplanMitHK,
  getModule,
} from "../actions";

export default async function NeueSequenzPage() {
  const [semesterList, klassenList, bildungsplaene, moduleList] =
    await Promise.all([
      getSemesterList(),
      getKlassenList(),
      getBildungsplanMitHK(),
      getModule(),
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
      />
    </div>
  );
}
