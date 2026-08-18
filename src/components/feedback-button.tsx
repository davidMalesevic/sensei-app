"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function FeedbackButton() {
  return (
    <a
      href={FEEDBACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 print:hidden"
    >
      <Button size="sm" className="shadow-md gap-1.5">
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </Button>
    </a>
  );
}
