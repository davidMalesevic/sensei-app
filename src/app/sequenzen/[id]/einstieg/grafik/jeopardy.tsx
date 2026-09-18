"use client";

import { useState } from "react";

import type { JeopardyFeld } from "@/lib/einstieg-daten";

/**
 * Jeopardy-Brett: Kategorien als Spalten, Punkte als Zeilen.
 *
 * Am Beamer wird ein Feld angeklickt und zeigt den Hinweis; ein zweiter Klick
 * gibt die erwartete Frage frei. Gespielte Felder bleiben markiert — im
 * Unterricht weiss sonst nach fünf Minuten niemand mehr, was schon dran war.
 * Gedruckt steht die Tabelle vollständig da, samt Lösungen.
 */
export function Jeopardy({ daten }: { daten: JeopardyFeld[] }) {
  const kategorien = [...new Set(daten.map((f) => f.kategorie))];
  const punkte = [...new Set(daten.map((f) => f.punkte))].sort((a, b) => a - b);
  const [offen, setOffen] = useState<string | null>(null);
  const [geloest, setGeloest] = useState<string[]>([]);
  const [gespielt, setGespielt] = useState<string[]>([]);

  const schluessel = (f: JeopardyFeld) => `${f.kategorie}-${f.punkte}`;
  const feld = (k: string, p: number) =>
    daten.find((f) => f.kategorie === k && f.punkte === p);

  const aktiv = daten.find((f) => schluessel(f) === offen);

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto print:hidden">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {kategorien.map((k) => (
                <th
                  key={k}
                  className="type-heading-compact-02 border border-border-subtle bg-layer-accent p-2 align-top"
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {punkte.map((p) => (
              <tr key={p}>
                {kategorien.map((k) => {
                  const f = feld(k, p);
                  if (!f) {
                    return <td key={k} className="border border-border-subtle p-2" />;
                  }
                  const s = schluessel(f);
                  return (
                    <td key={k} className="border border-border-subtle p-0">
                      <button
                        type="button"
                        onClick={() => {
                          setOffen(s);
                          setGeloest([]);
                          setGespielt((alt) =>
                            alt.includes(s) ? alt : [...alt, s]
                          );
                        }}
                        className={
                          "type-heading-03 h-16 w-full transition-colors hover:bg-layer-hover " +
                          (gespielt.includes(s)
                            ? "text-text-disabled line-through"
                            : "text-link")
                        }
                      >
                        {p}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aktiv && (
        <div className="border-l-[3px] border-l-border-interactive bg-layer p-4 print:hidden">
          <div className="type-label-02 text-text-helper">
            {aktiv.kategorie} · {aktiv.punkte}
          </div>
          <p className="type-heading-03 mt-1">{aktiv.hinweis}</p>
          {geloest.includes(offen!) ? (
            <div className="mt-4">
              <p className="type-body-02">
                <span className="text-text-helper">Erwartet: </span>
                {aktiv.erwartete_frage}
              </p>
              {aktiv.akzeptierte_varianten.length > 0 && (
                <p className="type-helper-02 mt-1 text-text-helper">
                  Gilt auch: {aktiv.akzeptierte_varianten.join(" · ")}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setGeloest((alt) => [...alt, offen!])}
              className="type-body-compact-02 mt-4 text-link underline-offset-2 hover:underline"
            >
              Auflösen
            </button>
          )}
        </div>
      )}

      {/* Gedruckt zählt die vollständige Liste, nicht das Brett. */}
      <div className="hidden print:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["Kategorie", "Punkte", "Hinweis", "Erwartete Frage"].map((t) => (
                <th key={t} className="border border-border-subtle p-2">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daten.map((f) => (
              <tr key={schluessel(f)}>
                <td className="border border-border-subtle p-2">{f.kategorie}</td>
                <td className="border border-border-subtle p-2 tabular-nums">
                  {f.punkte}
                </td>
                <td className="border border-border-subtle p-2">{f.hinweis}</td>
                <td className="border border-border-subtle p-2">
                  {f.erwartete_frage}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
