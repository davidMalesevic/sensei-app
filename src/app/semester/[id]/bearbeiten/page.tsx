import { notFound } from "next/navigation";
import { SemesterForm } from "../../semester-form";
import { getSemesterById, updateSemester } from "../../actions";

export default async function SemesterBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sem = await getSemesterById(id);

  if (!sem) return notFound();

  const updateAction = updateSemester.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Semester bearbeiten
        </h1>
        <p className="text-muted-foreground mt-1">{sem.bezeichnung}</p>
      </div>
      <SemesterForm
        semester={{
          id: sem.id,
          bezeichnung: sem.bezeichnung,
          startDatum: sem.startDatum,
          endDatum: sem.endDatum,
        }}
        action={updateAction}
      />
    </div>
  );
}
