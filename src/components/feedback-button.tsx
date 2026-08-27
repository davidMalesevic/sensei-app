import { Chat } from "@carbon/icons-react";

const FEEDBACK_URL =
  "https://github.com/davidMalesevic/sensei-app/issues/new?" +
  new URLSearchParams({
    labels: "feedback",
    title: "Feedback: ",
    body: [
      "## Was ist dir aufgefallen?",
      "",
      "",
      "",
      "## Welche Seite / Funktion betrifft es?",
      "",
      "",
      "",
      "## Vorschlag / Erwartung",
      "",
      "",
    ].join("\n"),
  }).toString();

/** Global Action in der UI Shell — kein schwebender Knopf über dem Inhalt. */
export function FeedbackButton() {
  return (
    <a
      href={FEEDBACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Feedback geben"
      title="Feedback geben"
      className="flex h-12 w-12 items-center justify-center text-shell-text transition-colors duration-[110ms] ease-carbon-standard hover:bg-shell-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white print:hidden"
    >
      <Chat size={20} />
    </a>
  );
}
