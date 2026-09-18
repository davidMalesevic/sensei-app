import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import type {
  Aussage,
  EscapeRoom,
  MCFrage,
  QuizFrage,
  VortestAufgabe,
} from "@/lib/einstieg-daten";

/**
 * Die Formate, die keine Zeichnung brauchen, sondern eine Ordnung: Aussagen,
 * Quizfragen, Vortest, diagnostische Fragen, Rätselkette.
 *
 * Überall gilt dasselbe: **was die Klasse sieht, steht oben; was die
 * Lehrperson wissen muss, steht getrennt darunter.** Ein Blatt, das man
 * austeilt, darf die Lösung nicht daneben tragen.
 */

function Loesung({ children }: { children: React.ReactNode }) {
  return (
    <p className="type-helper-02 mt-1 border-l-[3px] border-l-border-subtle pl-2 text-text-helper">
      {children}
    </p>
  );
}

export function Aussagen({ daten }: { daten: Aussage[] }) {
  return (
    <ol className="grid gap-3">
      {daten.map((a, i) => (
        <li key={i} className="break-inside-avoid">
          <div className="type-body-02 flex gap-2">
            <span className="font-mono text-text-helper">{i + 1}.</span>
            <span>{a.aussage}</span>
          </div>
          <Loesung>
            <Badge variant={a.korrekt ? "green" : "red"} size="sm">
              {a.korrekt ? "stimmt" : "stimmt nicht"}
            </Badge>{" "}
            {a.begruendung}
          </Loesung>
        </li>
      ))}
    </ol>
  );
}

export function Quizfragen({ daten }: { daten: QuizFrage[] }) {
  return (
    <ol className="grid gap-4">
      {daten.map((f, i) => (
        <li key={i} className="break-inside-avoid">
          <div className="type-heading-compact-02">
            {i + 1}. {f.frage}
            <span className="type-helper-02 ml-2 font-normal text-text-helper">
              {f.zeitlimit_sekunden} s
            </span>
          </div>
          <ul className="type-body-compact-02 mt-1 grid gap-0.5">
            {f.antworten.map((a, n) => (
              <li key={n} className={f.korrekt_indizes.includes(n) ? "font-semibold" : ""}>
                {String.fromCharCode(65 + n)}) {a}
                {f.korrekt_indizes.includes(n) && " ✓"}
              </li>
            ))}
          </ul>
          {f.erklaerung && <Loesung>{f.erklaerung}</Loesung>}
        </li>
      ))}
    </ol>
  );
}

export function DiagnostischeFragen({ daten }: { daten: MCFrage[] }) {
  return (
    <ol className="grid gap-4">
      {daten.map((f, i) => (
        <li key={i} className="break-inside-avoid">
          <div className="type-heading-compact-02">
            {i + 1}. {f.frage}
          </div>
          <ul className="type-body-compact-02 mt-1 grid gap-1">
            {f.antworten.map((a, n) => (
              <li key={n}>
                <span className={a.korrekt ? "font-semibold" : ""}>
                  {String.fromCharCode(65 + n)}) {a.text}
                  {a.korrekt && " ✓"}
                </span>
                {/* Der eigentliche Wert dieser Methode: jede falsche Antwort
                    steht für eine bestimmte Fehlvorstellung. */}
                {!a.korrekt && a.fehlvorstellung && (
                  <Loesung>{a.fehlvorstellung}</Loesung>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function Vortest({ daten }: { daten: VortestAufgabe[] }) {
  const punkte = daten.reduce((n, a) => n + a.punkte, 0);
  return (
    <div className="grid gap-4">
      <p className="type-helper-02 text-text-helper">
        {daten.length} Aufgaben · {punkte} Punkte
      </p>
      <ol className="grid gap-4">
        {daten.map((a) => (
          <li key={a.nr} className="break-inside-avoid">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="type-heading-compact-02">
                {a.nr}. {a.voraussetzung}
              </span>
              <Badge variant="cool-gray" size="sm">
                {a.niveau}
              </Badge>
              <span className="type-helper-02 text-text-helper">
                {a.punkte} P · {a.format}
              </span>
            </div>
            <Markdown text={a.aufgabe} className="mt-1" />
            <Loesung>{a.loesung}</Loesung>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Raetselkette({ daten }: { daten: EscapeRoom }) {
  return (
    <div className="grid gap-4">
      {daten.rahmengeschichte && (
        <p className="type-body-02 bg-layer p-3 print:bg-transparent print:p-0">
          {daten.rahmengeschichte}
        </p>
      )}
      <p className="type-body-compact-02">
        <span className="text-text-helper">Gesuchter Code: </span>
        <span className="font-mono tracking-widest">{daten.code}</span>
      </p>
      <ol className="grid gap-4">
        {daten.raetsel.map((r) => (
          <li key={r.nr} className="break-inside-avoid border border-border-subtle p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="type-heading-compact-02">
                {r.nr}. {r.titel}
              </span>
              <Badge variant="ghost" size="sm">
                {r.format}
              </Badge>
              <span className="type-helper-02 text-text-helper">
                ergibt «{r.codezeichen}»
              </span>
            </div>
            <Markdown text={r.aufgabe} className="mt-1" />
            <Loesung>
              Lösung: {r.loesung}
              {r.hinweise.length > 0 && (
                <>
                  {" · "}Tipps: {r.hinweise.join(" / ")}
                </>
              )}
            </Loesung>
          </li>
        ))}
      </ol>
    </div>
  );
}
