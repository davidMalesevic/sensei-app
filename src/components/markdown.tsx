import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Ein kleiner Markdown-Darsteller für KI-Texte.
 *
 * Die Methodenbibliothek verlangt von der KI ausdrücklich Markdown, «Tabellen
 * schreibst du als Markdown-Tabellen». Roh angezeigt ist eine solche Tabelle
 * eine Reihe von Strichen und Pipes — als Arbeitsblatt zum Austeilen
 * unbrauchbar. Hier wird daraus, was es sein soll.
 *
 * Bewusst klein und ohne Bibliothek: Überschriften, Fettes, Kursives, Code,
 * Listen, Tabellen, Trennlinien, Absätze. Es wird **kein HTML eingefügt** —
 * jeder Knoten ist ein React-Element, also kann aus einer KI-Antwort kein
 * Markup in die Seite gelangen.
 */

type Block =
  | { art: "ueberschrift"; stufe: number; text: string }
  | { art: "absatz"; zeilen: string[] }
  | { art: "liste"; nummeriert: boolean; punkte: string[] }
  | { art: "tabelle"; kopf: string[]; zeilen: string[][] }
  | { art: "linie" };

function istTabellenzeile(z: string) {
  return z.trim().startsWith("|") && z.trim().endsWith("|");
}

function zellen(z: string): string[] {
  return z
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

/** Die Zeile unter dem Tabellenkopf: `| :--- | ---: |`. */
function istTrennzeile(z: string) {
  return istTabellenzeile(z) && zellen(z).every((c) => /^:?-{3,}:?$/.test(c));
}

function parse(text: string): Block[] {
  const zeilen = text.replace(/\r\n/g, "\n").split("\n");
  const bloecke: Block[] = [];
  let i = 0;

  while (i < zeilen.length) {
    const zeile = zeilen[i];
    const roh = zeile.trim();

    if (roh === "") {
      i++;
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(roh)) {
      bloecke.push({ art: "linie" });
      i++;
      continue;
    }

    const ueberschrift = roh.match(/^(#{1,6})\s+(.*)$/);
    if (ueberschrift) {
      bloecke.push({
        art: "ueberschrift",
        stufe: ueberschrift[1].length,
        text: ueberschrift[2],
      });
      i++;
      continue;
    }

    if (istTabellenzeile(roh) && istTrennzeile(zeilen[i + 1] ?? "")) {
      const kopf = zellen(roh);
      i += 2;
      const reihen: string[][] = [];
      while (i < zeilen.length && istTabellenzeile(zeilen[i])) {
        reihen.push(zellen(zeilen[i]));
        i++;
      }
      bloecke.push({ art: "tabelle", kopf, zeilen: reihen });
      continue;
    }

    const punkt = roh.match(/^([-*+]|\d+[.)])\s+(.*)$/);
    if (punkt) {
      const nummeriert = /\d/.test(punkt[1]);
      const punkte: string[] = [];
      while (i < zeilen.length) {
        const m = zeilen[i].trim().match(/^([-*+]|\d+[.)])\s+(.*)$/);
        if (!m || /\d/.test(m[1]) !== nummeriert) break;
        punkte.push(m[2]);
        i++;
        // Eingerückte Folgezeilen gehören zum selben Punkt.
        while (i < zeilen.length && /^\s{2,}\S/.test(zeilen[i])) {
          punkte[punkte.length - 1] += ` ${zeilen[i].trim()}`;
          i++;
        }
      }
      bloecke.push({ art: "liste", nummeriert, punkte });
      continue;
    }

    const absatz: string[] = [];
    while (i < zeilen.length && zeilen[i].trim() !== "") {
      const naechste = zeilen[i].trim();
      if (
        /^#{1,6}\s/.test(naechste) ||
        /^([-*+]|\d+[.)])\s/.test(naechste) ||
        istTabellenzeile(naechste)
      ) {
        break;
      }
      absatz.push(naechste);
      i++;
    }
    if (absatz.length > 0) bloecke.push({ art: "absatz", zeilen: absatz });
    else i++;
  }

  return bloecke;
}

/** `**fett**`, `*kursiv*` und `` `code` `` — mehr braucht es hier nicht. */
function inline(text: string, schluessel: string): React.ReactNode[] {
  const teile: React.ReactNode[] = [];
  const muster = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|`[^`]+`)/g;
  let letzte = 0;
  let treffer: RegExpExecArray | null;
  let n = 0;

  while ((treffer = muster.exec(text)) !== null) {
    if (treffer.index > letzte) teile.push(text.slice(letzte, treffer.index));
    const t = treffer[0];
    const key = `${schluessel}-${n++}`;
    if (t.startsWith("**") || t.startsWith("__")) {
      teile.push(<strong key={key}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith("`")) {
      teile.push(
        <code key={key} className="bg-layer-accent px-1 font-mono">
          {t.slice(1, -1)}
        </code>
      );
    } else {
      teile.push(<em key={key}>{t.slice(1, -1)}</em>);
    }
    letzte = treffer.index + t.length;
  }
  if (letzte < text.length) teile.push(text.slice(letzte));
  return teile;
}

const UEBERSCHRIFT = ["type-heading-04", "type-heading-03", "type-heading-02"];

export function Markdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const bloecke = parse(text);

  return (
    <div className={cn("type-body-02 grid gap-3", className)}>
      {bloecke.map((b, i) => {
        if (b.art === "linie") {
          return <hr key={i} className="border-border-subtle" />;
        }
        if (b.art === "ueberschrift") {
          const Tag = (b.stufe <= 2 ? "h3" : "h4") as "h3" | "h4";
          return (
            <Tag
              key={i}
              className={UEBERSCHRIFT[Math.min(b.stufe, 3) - 1] ?? "type-heading-02"}
            >
              {inline(b.text, `h${i}`)}
            </Tag>
          );
        }
        if (b.art === "liste") {
          const Tag = b.nummeriert ? "ol" : "ul";
          return (
            <Tag
              key={i}
              className={cn(
                "grid gap-1 pl-6",
                b.nummeriert ? "list-decimal" : "list-disc"
              )}
            >
              {b.punkte.map((p, n) => (
                <li key={n}>{inline(p, `l${i}-${n}`)}</li>
              ))}
            </Tag>
          );
        }
        if (b.art === "tabelle") {
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {b.kopf.map((z, n) => (
                      <th
                        key={n}
                        className="type-heading-compact-02 border border-border-subtle bg-layer-accent px-3 py-2 align-top print:bg-transparent"
                      >
                        {inline(z, `th${i}-${n}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.zeilen.map((r, n) => (
                    <tr key={n}>
                      {r.map((z, m) => (
                        <td
                          key={m}
                          className="border border-border-subtle px-3 py-2 align-top"
                        >
                          {inline(z, `td${i}-${n}-${m}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {b.zeilen.map((z, n) => (
              <React.Fragment key={n}>
                {n > 0 && <br />}
                {inline(z, `p${i}-${n}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
