import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSequenzById } from "../../actions";
import { PrintButton } from "./print-button";

function getBlockDauer(blockTyp: "2er" | "4er"): number {
  return blockTyp === "2er" ? 90 : 180;
}

const sozialformLabels: Record<string, string> = {
  EA: "Einzelarbeit",
  PA: "Partnerarbeit",
  GA: "Gruppenarbeit",
  Plenum: "Plenum",
};

export default async function SequenzDruckenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seq = await getSequenzById(id);
  if (!seq) return notFound();

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { font-size: 10pt; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          .block-card { break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between no-print">
          <Button
            variant="ghost"
            render={<Link href={`/sequenzen/${id}`} />}
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <PrintButton />
        </div>

        <header className="border-b pb-4">
          <h1 className="text-2xl font-bold">{seq.titel}</h1>
          <div className="text-sm text-muted-foreground mt-1 flex gap-3">
            {seq.modul && <span>Modul {seq.modul.nummer}</span>}
            <span>{seq.klasse.bezeichnung}</span>
            <span>{seq.semester.bezeichnung}</span>
          </div>
        </header>

        {(seq.beschreibung || seq.praxisbezug) && (
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            {seq.beschreibung && (
              <div>
                <h2 className="font-semibold mb-1">Beschreibung</h2>
                <p className="whitespace-pre-wrap">{seq.beschreibung}</p>
              </div>
            )}
            {seq.praxisbezug && (
              <div>
                <h2 className="font-semibold mb-1">Praxisbezug</h2>
                <p className="whitespace-pre-wrap">{seq.praxisbezug}</p>
              </div>
            )}
          </div>
        )}

        {seq.handlungskompetenzen.length > 0 && (
          <div className="text-sm">
            <h2 className="font-semibold mb-1">Handlungskompetenzen</h2>
            <ul className="list-disc list-inside">
              {seq.handlungskompetenzen.map((shk) => (
                <li key={shk.id}>
                  <strong>{shk.handlungskompetenz.kuerzel}</strong> –{" "}
                  {shk.handlungskompetenz.bezeichnung}
                </li>
              ))}
            </ul>
          </div>
        )}

        {seq.materialien.length > 0 && (
          <div className="text-sm">
            <h2 className="font-semibold mb-1">Materialien (Sequenz)</h2>
            <ul className="list-disc list-inside">
              {seq.materialien.map((m) => (
                <li key={m.id}>
                  {m.titel}
                  {m.url && (
                    <span className="text-muted-foreground"> – {m.url}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-6 pt-2">
          <h2 className="text-lg font-semibold border-b pb-1">
            Lektionsblöcke
          </h2>

          {seq.lektionsbloecke.map((block, blockIdx) => {
            const maxMin = getBlockDauer(block.blockTyp);
            const totalMin = block.phasen.reduce(
              (s, p) => s + (p.dauerMinuten ?? 0),
              0
            );

            return (
              <div
                key={block.id}
                className="block-card border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {block.thema || `Block ${blockIdx + 1}`}
                  </h3>
                  <div className="text-sm text-muted-foreground flex gap-3">
                    <span>{block.blockTyp}-Block ({maxMin} Min.)</span>
                    {block.datum && (
                      <span>
                        {new Date(block.datum).toLocaleDateString("de-CH", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {block.phasenmodell && <span>{block.phasenmodell.name}</span>}
                  </div>
                </div>

                {block.phasen.length > 0 && (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1 pr-2 font-medium">Phase</th>
                        <th className="py-1 pr-2 font-medium w-24">Dauer</th>
                        <th className="py-1 pr-2 font-medium w-32">
                          Sozialform
                        </th>
                        <th className="py-1 pr-2 font-medium w-56">Methode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.phasen.map((p) => (
                        <>
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-2">{p.bezeichnung}</td>
                            <td className="py-1.5 pr-2">
                              {p.dauerMinuten ? `${p.dauerMinuten}'` : "–"}
                            </td>
                            <td className="py-1.5 pr-2">
                              {p.sozialform
                                ? sozialformLabels[p.sozialform]
                                : "–"}
                            </td>
                            <td className="py-1.5 pr-2">
                              {p.methode || "–"}
                            </td>
                          </tr>
                          {p.beschreibung && (
                            <tr key={`${p.id}-desc`}>
                              <td
                                colSpan={4}
                                className="py-1 pb-2 text-xs text-muted-foreground whitespace-pre-wrap pl-4"
                              >
                                {p.beschreibung}
                              </td>
                            </tr>
                          )}
                          {p.materialien.length > 0 && (
                            <tr key={`${p.id}-mat`}>
                              <td
                                colSpan={4}
                                className="py-1 pb-2 text-xs pl-4"
                              >
                                {p.materialien.map((m) => (
                                  <span
                                    key={m.id}
                                    className="inline-block mr-3 text-muted-foreground"
                                  >
                                    📎 {m.titel}
                                  </span>
                                ))}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-medium">
                        <td className="py-1.5 pr-2">Total</td>
                        <td className="py-1.5 pr-2">
                          {totalMin}' / {maxMin}'
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                )}

                {block.materialien.length > 0 && (
                  <div className="text-xs text-muted-foreground pt-1">
                    <strong>Material:</strong>{" "}
                    {block.materialien.map((m) => m.titel).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
