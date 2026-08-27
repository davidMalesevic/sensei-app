import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, Circle } from "lucide-react";
import {
  getBildungsplanMitHK,
  getCoverageData,
  getKlassenForFilter,
  getModulLookup,
  getModuleGrouped,
} from "./actions";
import { KlasseFilter } from "./klasse-filter";
import { ModulSection } from "./modul-section";

export default async function BildungsplanPage({
  searchParams,
}: {
  searchParams: Promise<{ klasse?: string }>;
}) {
  const { klasse: klasseId } = await searchParams;

  const [bildungsplaene, coverageData, klassen, modulLookup, moduleGrouped] = await Promise.all([
    getBildungsplanMitHK(),
    getCoverageData(klasseId),
    getKlassenForFilter(),
    getModulLookup(),
    getModuleGrouped(),
  ]);

  const allHKs = bildungsplaene.flatMap((bp) =>
    bp.handlungskompetenzbereiche.flatMap((hkb) => hkb.handlungskompetenzen)
  );
  const totalHKs = allHKs.length;
  const coveredHKs = allHKs.filter((hk) => coverageData[hk.id]).length;

  const selectedKlasse = klasseId
    ? klassen.find((k) => k.id === klasseId)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bildungsplan</h1>
        <p className="text-muted-foreground mt-1">
          Handlungskompetenzbereiche und Handlungskompetenzen des Bildungsplans
          EDB.
        </p>
      </div>

      <Tabs defaultValue="uebersicht">
        <TabsList>
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="module">
            Module ({moduleGrouped.length})
          </TabsTrigger>
          <TabsTrigger value="coverage">
            Coverage-Matrix ({coveredHKs}/{totalHKs})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uebersicht" className="mt-4">
          {bildungsplaene.map((bp) => (
            <Card key={bp.id}>
              <CardHeader>
                <CardTitle>
                  {bp.bezeichnung}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    Berufsnummer {bp.berufsnummer} · {bp.version}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion
                  defaultValue={bp.handlungskompetenzbereiche.map(
                    (hkb) => hkb.id
                  )}
                >
                  {bp.handlungskompetenzbereiche.map((hkb) => (
                    <AccordionItem key={hkb.id} value={hkb.id}>
                      <AccordionTrigger>
                        <span className="text-left">
                          <strong>HKB {hkb.kuerzel}</strong> –{" "}
                          {hkb.bezeichnung}
                          <span className="text-muted-foreground text-sm ml-2">
                            ({hkb.handlungskompetenzen.length} HK)
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Accordion>
                          {hkb.handlungskompetenzen.map((hk) => (
                            <AccordionItem key={hk.id} value={hk.id}>
                              <AccordionTrigger className="text-sm py-2">
                                <span className="text-left">
                                  <strong>{hk.kuerzel}</strong> –{" "}
                                  {hk.bezeichnung}
                                </span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3 pl-2">
                                  {hk.beschreibung && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                        Beschreibung / Lernziele
                                      </h4>
                                      <p className="text-sm whitespace-pre-wrap">
                                        {hk.beschreibung}
                                      </p>
                                    </div>
                                  )}
                                  {hk.moduleBerufsfachschule &&
                                    (hk.moduleBerufsfachschule as number[])
                                      .length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                          Module Berufsfachschule
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5">
                                          {(
                                            hk.moduleBerufsfachschule as number[]
                                          ).map((mod) => (
                                            <Badge
                                              key={mod}
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {mod}
                                              {modulLookup[mod] &&
                                                ` – ${modulLookup[mod]}`}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="module" className="mt-4">
          <ModulSection module={moduleGrouped} />
        </TabsContent>

        <TabsContent value="coverage" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>
                  Coverage-Matrix
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {coveredHKs} von {totalHKs} abgedeckt
                    {selectedKlasse && ` (${selectedKlasse.bezeichnung})`}
                  </span>
                </CardTitle>
                <KlasseFilter klassen={klassen} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">HK</TableHead>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead className="w-[80px] text-center">
                        Status
                      </TableHead>
                      <TableHead className="w-[60px] text-center">
                        Anzahl
                      </TableHead>
                      <TableHead>Zugeordnete Sequenzen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bildungsplaene.map((bp) =>
                      bp.handlungskompetenzbereiche.map((hkb) => (
                        <>
                          <TableRow
                            key={`hkb-${hkb.id}`}
                            className="bg-muted/50"
                          >
                            <TableCell
                              colSpan={5}
                              className="font-semibold text-sm"
                            >
                              HKB {hkb.kuerzel} – {hkb.bezeichnung}
                            </TableCell>
                          </TableRow>
                          {hkb.handlungskompetenzen.map((hk) => {
                            const coverage = coverageData[hk.id];
                            const count = coverage?.sequenzen.length ?? 0;
                            return (
                              <TableRow key={hk.id}>
                                <TableCell className="font-medium">
                                  {hk.kuerzel}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {hk.bezeichnung}
                                </TableCell>
                                <TableCell className="text-center">
                                  {count > 0 ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 inline-block" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground inline-block" />
                                  )}
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                  {count}
                                </TableCell>
                                <TableCell>
                                  {count > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {coverage!.sequenzen.map((seq) => (
                                        <Badge
                                          key={seq.id}
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          <Link
                                            href={`/sequenzen/${seq.id}`}
                                            className="hover:underline"
                                          >
                                            {seq.titel}
                                          </Link>
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Noch nicht abgedeckt
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
