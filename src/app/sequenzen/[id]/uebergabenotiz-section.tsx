"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, MessageSquare, Save } from "lucide-react";

export function UebergabenotizSection({
  sequenzId,
  currentNotiz,
  vorherigeNotiz,
  saveAction,
}: {
  sequenzId: string;
  currentNotiz: string | null;
  vorherigeNotiz: { notiz: string; titel: string } | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {vorherigeNotiz && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Notiz aus vorheriger Sequenz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-1">
              Aus: {vorherigeNotiz.titel}
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {vorherigeNotiz.notiz}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Übergabenotiz für nächste Sequenz
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-3">
            <Textarea
              name="uebergabenotiz"
              placeholder="Fortschritt, offene Punkte, Hinweise für die nächste Sequenz mit dieser Klasse und diesem Modul..."
              defaultValue={currentNotiz ?? ""}
              rows={3}
            />
            <Button type="submit" size="sm">
              <Save className="h-4 w-4" />
              Notiz speichern
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
