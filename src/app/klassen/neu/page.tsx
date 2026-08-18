import { KlasseForm } from "../klasse-form";
import { createKlasse } from "../actions";

export default function NeueKlassePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Neue Klasse</h1>
        <p className="text-muted-foreground mt-1">
          Erstelle eine neue Klasse.
        </p>
      </div>
      <KlasseForm action={createKlasse} />
    </div>
  );
}
