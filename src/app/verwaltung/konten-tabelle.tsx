"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Add, Copy, Checkmark, TrashCan, Password, Logout } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, HelperText } from "@/components/ui/label";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  beendeSitzungen, ladeEin, loescheKonto, nimmEinladungZurueck,
  setzeAdmin, setzePasswortZurueck, type VerwaltungZustand,
} from "./actions";

export type Konto = {
  id: string; email: string; name: string; istAdmin: boolean;
  createdAt: Date; letzteAnmeldung: Date | null;
  klassen: number; sequenzen: number; module: number; materialien: number;
  sitzungen: number;
};

export type Einladung = {
  tokenHash: string; email: string; createdAt: Date; expiresAt: Date;
};

function datum(d: Date | null): string {
  if (!d) return "nie";
  return new Date(d).toLocaleDateString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function inTagen(d: Date): string {
  const tage = Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);
  return tage <= 1 ? "heute" : `in ${tage} Tagen`;
}

/** Zeigt einen erzeugten Einmal-Link — er ist danach nirgends mehr abrufbar. */
function LinkAusgabe({ link, hinweis }: { link: string; hinweis?: string }) {
  const [kopiert, setKopiert] = useState(false);
  const voll = typeof window !== "undefined" ? window.location.origin + link : link;

  return (
    <Notification kind="success" titel="Link erzeugt" className="mb-4">
      <span className="block">{hinweis}</span>
      <code className="type-helper-02 mt-2 block font-mono break-all text-foreground">
        {voll}
      </code>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => {
          navigator.clipboard?.writeText(voll);
          setKopiert(true);
          setTimeout(() => setKopiert(false), 2000);
        }}
      >
        {kopiert ? "Kopiert" : "Link kopieren"}
        {kopiert ? <Checkmark size={16} /> : <Copy size={16} />}
      </Button>
      <span className="type-helper-02 mt-2 block text-text-helper">
        Dieser Link erscheint nur jetzt — in der Datenbank steht nur sein Hash.
      </span>
    </Notification>
  );
}

function EinladenFormular() {
  const [zustand, action, laeuft] = useActionState<VerwaltungZustand, FormData>(ladeEin, {});

  return (
    <>
      {zustand.fehler && (
        <Notification kind="error" titel="Einladung nicht möglich" className="mb-4">
          {zustand.fehler}
        </Notification>
      )}
      {zustand.link && <LinkAusgabe link={zustand.link} hinweis={zustand.hinweis} />}

      <form action={action} className="flex flex-wrap items-end gap-4 bg-layer p-4">
        <div className="min-w-72 flex-1">
          <Label htmlFor="einladung-email">E-Mail der Person</Label>
          <Input
            id="einladung-email"
            name="email"
            type="email"
            placeholder="vorname.nachname@wst.ch"
            required
            className="mt-2"
          />
          <HelperText className="mt-2">
            Mit dieser Adresse meldet sich die Person später an — sie kann sie
            beim Anlegen nicht ändern.
          </HelperText>
        </div>
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Wird erzeugt…" : "Einladen"}
          <Add size={16} />
        </Button>
      </form>
    </>
  );
}

function PasswortZuruecksetzen({ konto }: { konto: Konto }) {
  const [zustand, action, laeuft] = useActionState<VerwaltungZustand, FormData>(
    setzePasswortZurueck, {}
  );

  return (
    <>
      <form action={action}>
        <input type="hidden" name="benutzerId" value={konto.id} />
        <Button
          type="submit"
          variant="ghost-neutral"
          size="icon-sm"
          disabled={laeuft}
          aria-label={`Passwort-Link für ${konto.email}`}
          title="Passwort-Link erzeugen"
        >
          <Password size={16} />
        </Button>
      </form>
      {zustand.link && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl p-4">
          <LinkAusgabe link={zustand.link} hinweis={zustand.hinweis} />
        </div>
      )}
    </>
  );
}

function KontoLoeschen({ konto }: { konto: Konto }) {
  const [offen, setOffen] = useState(false);
  const [zustand, action, laeuft] = useActionState<VerwaltungZustand, FormData>(
    loescheKonto, {}
  );

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger
        render={
          <Button
            variant="destructive-ghost"
            size="icon-sm"
            aria-label={`${konto.email} löschen`}
            title="Konto löschen"
          />
        }
      >
        <TrashCan size={16} />
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Konto löschen</DialogTitle>
        </DialogHeader>

        <form action={action} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="benutzerId" value={konto.id} />
          <DialogBody>
            <DialogDescription>
              <strong>{konto.name}</strong> wird mit allem entfernt, was daran
              hängt: {konto.klassen} Klassen, {konto.sequenzen} Sequenzen,{" "}
              {konto.module} Module und {konto.materialien} Materialien. Das
              lässt sich nicht rückgängig machen.
            </DialogDescription>

            {zustand.fehler && (
              <Notification kind="error" titel="Nicht gelöscht" className="mt-6">
                {zustand.fehler}
              </Notification>
            )}

            <div className="mt-8">
              <Label htmlFor={`best-${konto.id}`}>
                Zum Bestätigen «{konto.email}» tippen
              </Label>
              <Input
                id={`best-${konto.id}`}
                name="bestaetigung"
                autoComplete="off"
                required
                className="mt-2"
              />
            </div>
          </DialogBody>

          <DialogFooter showCloseButton>
            <Button
              type="submit"
              variant="destructive"
              disabled={laeuft}
              className="h-16 flex-1 items-start pt-4"
            >
              {laeuft ? "Wird gelöscht…" : "Endgültig löschen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function KontenTabelle({
  konten,
  einladungen,
  eigeneId,
}: {
  konten: Konto[];
  einladungen: Einladung[];
  eigeneId: string;
}) {
  const router = useRouter();
  const [laeuft, startTransition] = useTransition();
  const admins = konten.filter((k) => k.istAdmin).length;

  return (
    <>
      <section className="mb-12">
        <SectionHeader
          titel="Person einladen"
          beschreibung="Ein Link pro Person, sieben Tage gültig, genau einmal verwendbar."
        />
        <EinladenFormular />
      </section>

      {einladungen.length > 0 && (
        <section className="mb-12">
          <SectionHeader titel={`Offene Einladungen (${einladungen.length})`} />
          <div className="bg-layer">
            {einladungen.map((e) => (
              <div
                key={e.tokenHash}
                className="type-body-compact-02 flex flex-wrap items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0"
              >
                <span className="min-w-64 flex-1 font-semibold">{e.email}</span>
                <span className="text-text-secondary">
                  läuft ab {inTagen(e.expiresAt)}
                </span>
                <Button
                  variant="destructive-ghost"
                  size="sm"
                  disabled={laeuft}
                  onClick={() =>
                    startTransition(async () => {
                      await nimmEinladungZurueck(e.tokenHash);
                      router.refresh();
                    })
                  }
                >
                  Zurücknehmen
                  <TrashCan size={16} />
                </Button>
              </div>
            ))}
          </div>
          <HelperText className="mt-2">
            Den Link selbst kann niemand nachträglich abrufen — er stand nur
            beim Erzeugen da. Zum erneuten Verschicken die Einladung
            zurücknehmen und neu erstellen.
          </HelperText>
        </section>
      )}

      <section>
        <SectionHeader titel={`Konten (${konten.length})`} />
        <Table className="min-w-[64rem] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-layer-accent">
              <TableHead className="w-56">Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead className="w-32">Angelegt</TableHead>
              <TableHead className="w-32">Zuletzt da</TableHead>
              <TableHead className="w-44">Daten</TableHead>
              <TableHead className="w-28">Admin</TableHead>
              <TableHead className="w-40 text-right">
                <span className="sr-only">Aktionen</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {konten.map((k) => {
              const ichSelbst = k.id === eigeneId;
              const letzterAdmin = k.istAdmin && admins <= 1;
              return (
                <TableRow key={k.id}>
                  <TableCell className="truncate font-semibold">
                    {k.name}
                    {ichSelbst && (
                      <Badge variant="blue" size="sm" className="ml-2">du</Badge>
                    )}
                  </TableCell>
                  <TableCell className="truncate text-text-secondary">
                    {k.email}
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {datum(k.createdAt)}
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {datum(k.letzteAnmeldung)}
                  </TableCell>
                  <TableCell className="type-helper-02 text-text-secondary">
                    {k.klassen} Kl · {k.sequenzen} Seq · {k.module} Mod
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="carbon-checkbox"
                      checked={k.istAdmin}
                      disabled={laeuft || ichSelbst || letzterAdmin}
                      aria-label={`${k.name} ist Admin`}
                      title={
                        ichSelbst
                          ? "Das eigene Recht lässt sich hier nicht entziehen"
                          : letzterAdmin
                            ? "Der letzte Admin kann nicht entfernt werden"
                            : undefined
                      }
                      onChange={(e) =>
                        startTransition(async () => {
                          await setzeAdmin(k.id, e.target.checked);
                          router.refresh();
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="pr-2">
                    <div className="flex items-center justify-end gap-px">
                      {k.sitzungen > 0 && (
                        <Button
                          variant="ghost-neutral"
                          size="icon-sm"
                          disabled={laeuft}
                          aria-label={`${k.sitzungen} Sitzungen von ${k.name} beenden`}
                          title={`${k.sitzungen} offene Sitzungen beenden`}
                          onClick={() =>
                            startTransition(async () => {
                              await beendeSitzungen(k.id);
                              router.refresh();
                            })
                          }
                        >
                          <Logout size={16} />
                        </Button>
                      )}
                      <PasswortZuruecksetzen konto={k} />
                      {!ichSelbst && <KontoLoeschen konto={k} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
