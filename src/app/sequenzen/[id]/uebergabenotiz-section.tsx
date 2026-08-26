"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  MessageSquare,
  Save,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { suggestUebergabenotiz } from "../actions";

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
  const [notiz, setNotiz] = useState(currentNotiz ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function vorschlagen() {
    setFehler(null);
    startTransition(async () => {
      const res = await suggestUebergabenotiz(sequenzId);
      if (res.success && res.notiz) {
        setNotiz(res.notiz);
      } else {
        setFehler(res.error ?? "Vorschlag fehlgeschlagen.");
      }
    });
  }

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
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Übergabenotiz für nächste Sequenz
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={vorschlagen}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              KI-Vorschlag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-3">
            <Textarea
              name="uebergabenotiz"
              placeholder="Fortschritt, offene Punkte, Hinweise für die nächste Sequenz mit dieser Klasse und diesem Modul..."
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={notiz ? 6 : 3}
            />
            {fehler && (
              <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded p-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{fehler}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Der KI-Vorschlag ist ein Entwurf — prüfe ihn, «(?)» markiert
              Unsicherheiten. Gespeichert wird erst beim Klick auf Speichern.
            </p>
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
