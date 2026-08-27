import { Fragment } from "react";
import Link from "next/link";
import { CheckmarkFilled, CircleDash } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
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
import { Notification } from "@/components/ui/notification";
import { PageHeader } from "@/components/ui/page-header";
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

  const [bildungsplaene, coverageData, klassen, modulLookup, moduleGrouped] =
    await Promise.all([
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
    <>
      <PageHeader
        titel="Bildungsplan"
        beschreibung="Handlungskompetenzbereiche und Handlungskompetenzen des Bildungsplans EDB, dazu die Module mit Material, Aufgabenbaum und Modulplan."
      />

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

        <TabsContent value="uebersicht">
          {bildungsplaene.map((bp) => (
            <div key={bp.id} className="mb-12">
              <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border-strong pb-2">
                <h2 className="type-heading-03 text-foreground">
                  {bp.bezeichnung}
                </h2>
                <span className="type-helper-02 text-text-helper">
                  Berufsnummer {bp.berufsnummer} · {bp.version}
                </span>
              </div>

              <Accordion
                defaultValue={bp.handlungskompetenzbereiche.map((hkb) => hkb.id)}
                className="bg-layer"
              >
                {bp.handlungskompetenzbereiche.map((hkb) => (
                  <AccordionItem key={hkb.id} value={hkb.id}>
                    <AccordionTrigger>
                      <span className="text-left">
                        <span className="type-heading-compact-02">
                          HKB {hkb.kuerzel}
                        </span>
                        <span className="text-text-secondary">
                          {" "}
                          — {hkb.bezeichnung}
                        </span>
                        <span className="type-helper-02 ml-2 text-text-helper">
                          ({hkb.handlungskompetenzen.length} HK)
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <Accordion className="border-b-0">
                        {hkb.handlungskompetenzen.map((hk) => (
                          <AccordionItem key={hk.id} value={hk.id}>
                            <AccordionTrigger className="pl-8">
                              <span className="text-left">
                                <span className="type-heading-compact-02">
                                  {hk.kuerzel}
                                </span>
                                <span className="text-text-secondary">
                                  {" "}
                                  — {hk.bezeichnung}
                                </span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="pl-8">
                              <div className="space-y-6">
                                {hk.beschreibung && (
                                  <div>
                                    <h4 className="type-label-02 mb-2 text-text-helper">
                                      Beschreibung / Lernziele
                                    </h4>
                                    <p className="type-body-02 whitespace-pre-wrap text-foreground">
                                      {hk.beschreibung}
                                    </p>
                                  </div>
                                )}
                                {hk.moduleBerufsfachschule &&
                                  (hk.moduleBerufsfachschule as number[]).length >
                                    0 && (
                                    <div>
                                      <h4 className="type-label-02 mb-2 text-text-helper">
                                        Module Berufsfachschule
                                      </h4>
                                      <div className="flex flex-wrap gap-2">
                                        {(
                                          hk.moduleBerufsfachschule as number[]
                                        ).map((mod) => (
                                          <Badge
                                            key={mod}
                                            variant="cool-gray"
                                            size="sm"
                                          >
                                            {mod}
                                            {modulLookup[mod] &&
                                              ` — ${modulLookup[mod]}`}
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
            </div>
          ))}
        </TabsContent>

        <TabsContent value="module">
          <ModulSection module={moduleGrouped} />
        </TabsContent>

        <TabsContent value="coverage">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="type-heading-03 text-foreground">Coverage-Matrix</h2>
              <p className="type-body-02 mt-1 text-text-secondary">
                {coveredHKs} von {totalHKs} abgedeckt
                {selectedKlasse && ` · ${selectedKlasse.bezeichnung}`}
              </p>
            </div>
            <KlasseFilter klassen={klassen} />
          </div>

          {coveredHKs === 0 && (
            <Notification
              kind="info"
              titel="Ohne Datenbasis"
              className="mb-4"
            >
              Die HK-Zuordnung pro Sequenz wurde mit der Umstellung auf den
              Stundenplan-Prozess entfernt. Die Matrix bleibt als Übersicht der
              Kompetenzen stehen, zählt aber nichts mehr.
            </Notification>
          )}

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-layer-accent">
                <TableHead className="w-24">HK</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-20 text-center">Anzahl</TableHead>
                <TableHead>Zugeordnete Sequenzen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bildungsplaene.map((bp) =>
                bp.handlungskompetenzbereiche.map((hkb) => (
                  <Fragment key={hkb.id}>
                    <TableRow className="bg-layer-accent hover:bg-layer-accent">
                      <TableCell colSpan={5} className="type-heading-compact-02">
                        HKB {hkb.kuerzel} — {hkb.bezeichnung}
                      </TableCell>
                    </TableRow>
                    {hkb.handlungskompetenzen.map((hk) => {
                      const coverage = coverageData[hk.id];
                      const count = coverage?.sequenzen.length ?? 0;
                      return (
                        <TableRow key={hk.id}>
                          <TableCell className="font-semibold">
                            {hk.kuerzel}
                          </TableCell>
                          <TableCell className="whitespace-normal text-text-secondary">
                            {hk.bezeichnung}
                          </TableCell>
                          <TableCell className="text-center">
                            {count > 0 ? (
                              <CheckmarkFilled
                                size={16}
                                className="inline-block text-support-success"
                              />
                            ) : (
                              <CircleDash
                                size={16}
                                className="inline-block text-text-placeholder"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-text-secondary">
                            {count}
                          </TableCell>
                          <TableCell>
                            {count > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {coverage!.sequenzen.map((seq) => (
                                  <Badge
                                    key={seq.id}
                                    variant="blue"
                                    size="sm"
                                    render={
                                      <Link href={`/sequenzen/${seq.id}`} />
                                    }
                                  >
                                    {seq.titel}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-text-placeholder">
                                Noch nicht abgedeckt
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </>
  );
}
