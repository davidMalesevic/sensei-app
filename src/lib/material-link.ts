/**
 * Baut aus einer Task-Referenz einen Link, der möglichst direkt an die
 * Fundstelle springt. PDFs unterstützen `#page=N` im Viewer; für andere
 * Formate bleibt es beim Link auf die Datei.
 */

const SEITEN_MUSTER = [
  /\bseite\s*(\d{1,4})/i,
  /\bs\.\s*(\d{1,4})/i,
  /\bfolie\s*(\d{1,4})/i,
  /\bslide\s*(\d{1,4})/i,
  /\bpage\s*(\d{1,4})/i,
];

export function seitenzahlAusReferenz(referenz: string | null): number | null {
  if (!referenz) return null;
  for (const muster of SEITEN_MUSTER) {
    const treffer = referenz.match(muster);
    if (treffer) {
      const n = parseInt(treffer[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

export function materialHref(
  material: { dateiPfad: string | null; url: string | null },
  referenz?: string | null
): string | null {
  const basis = material.dateiPfad
    ? `/api/files/${material.dateiPfad}`
    : material.url;

  if (!basis) return null;

  const seite = seitenzahlAusReferenz(referenz ?? null);
  const istPdf = material.dateiPfad
    ? material.dateiPfad.toLowerCase().endsWith(".pdf")
    : /\.pdf($|\?)/i.test(basis);

  return seite && istPdf ? `${basis}#page=${seite}` : basis;
}
