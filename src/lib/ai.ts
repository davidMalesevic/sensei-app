const OLLAMA_URL = "https://ollama.com/v1/chat/completions";

export type AIResult =
  | { success: true; content: string }
  | { success: false; error: string };

/**
 * Ruft das konfigurierte Ollama-Modell auf und gibt den rohen Text zurück.
 * Zentral, damit alle KI-Features (Planung, Material-Extraktion, Bausteine)
 * dieselbe Konfiguration und Fehlerbehandlung teilen.
 */
export async function callAI(
  prompt: string,
  temperature = 0.7
): Promise<AIResult> {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return { success: false, error: "OLLAMA_API_KEY nicht konfiguriert." };
  }

  const model = process.env.OLLAMA_MODEL || "gemma4:31b";

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Ollama API Fehler ${response.status}: ${body}`,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { success: false, error: "Unerwartete Antwort der KI." };
    }
    return { success: true, content };
  } catch (e) {
    return { success: false, error: `API-Verbindungsfehler: ${e}` };
  }
}

/**
 * Löst JSON aus einer KI-Antwort — auch wenn es in einem Markdown-Codeblock
 * steckt oder von erklärendem Text umgeben ist.
 */
export function parseJsonFromAI<T>(raw: string): T | null {
  let cleaned = raw.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fallback: erstes {...} oder [...] aus dem Text schneiden
    const start = cleaned.search(/[{[]/);
    if (start === -1) return null;
    const openChar = cleaned[start];
    const closeChar = openChar === "{" ? "}" : "]";
    const end = cleaned.lastIndexOf(closeChar);
    if (end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}
