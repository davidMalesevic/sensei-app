import { SemesterForm } from "../semester-form";
import { createSemester } from "../actions";

export default function NeuesSemesterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Neues Semester</h1>
        <p className="text-muted-foreground mt-1">
          Erstelle ein neues Semester für deine Unterrichtsplanung.
        </p>
      </div>
      <SemesterForm action={createSemester} />
    </div>
  );
}
