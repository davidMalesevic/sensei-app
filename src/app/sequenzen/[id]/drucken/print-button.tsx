"use client";

import { Printer } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      Drucken / PDF
      <Printer size={16} />
    </Button>
  );
}
