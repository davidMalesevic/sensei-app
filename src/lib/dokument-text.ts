/**
 * Textextraktion aus hochgeladenen bzw. eingefügten Dokumenten.
 * Wird vom Modulplan-Import und von der KI-Material-Extraktion genutzt.
 */

const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".html", ".htm", ".xml"];

/** Entfernt Markup, behält aber Zeilenstruktur (Tabellenzeilen bleiben lesbar). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(tr|p|div|li|h[1-6]|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.replace(/\s*\|\s*$/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export async function pdfToText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages
    .map((seite, i) => `--- Seite ${i + 1} ---\n${seite.trim()}`)
    .join("\n\n");
}

export function isTextExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

/** Extrahiert Text aus einem Buffer anhand des Dateinamens. */
export async function extractDokumentText(
  filename: string,
  buffer: Buffer
): Promise<string | null> {
  if (isPdf(filename)) return pdfToText(buffer);
  if (isTextExtension(filename)) {
    const raw = buffer.toString("utf-8");
    return /\.html?$|\.xml$/i.test(filename) ? htmlToText(raw) : raw;
  }
  return null;
}
