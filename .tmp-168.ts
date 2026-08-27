import { readFileSync } from "fs";
import { isSmartlearnExport, parseModularbeitsplan, parseSmartlearnStruktur } from "./src/lib/smartlearn";
import { htmlToText } from "./src/lib/dokument-text";

const roh = readFileSync("assets/M168.html", "utf-8");
console.log("Grösse:", (roh.length / 1e6).toFixed(1), "MB");
console.log("base64-Bilder:", (roh.match(/data:image\//g) ?? []).length);
console.log("<h1-6>:", (roh.match(/<h[1-6][\s>]/gi) ?? []).length);

const t0 = Date.now();
const text = htmlToText(roh);
console.log(`htmlToText: ${Date.now() - t0}ms, ${(text.length / 1000).toFixed(0)}k Zeichen`);
console.log("isSmartlearnExport:", isSmartlearnExport(text));
console.log("  'Modularbeitsplan' vorhanden:", /Modularbeitsplan/i.test(text));
console.log("  'Block & Lern- und Arbeitsauftrag':", /Block\s*&\s*Lern-\s*und\s*Arbeitsauftrag/i.test(text));

const t1 = Date.now();
const wochen = parseModularbeitsplan(text);
console.log(`\nModularbeitsplan: ${wochen.length} Wochen (${Date.now() - t1}ms)`);
for (const w of wochen.slice(0, 5))
  console.log(`  KW ${w.kw} Blöcke ${JSON.stringify(w.bloecke)} LA ${JSON.stringify(w.laCodes)} — ${w.ziel.slice(0, 60)}`);

const t2 = Date.now();
const baum = parseSmartlearnStruktur(roh);
console.log(`\nBaum: ${baum.length} Blöcke (${Date.now() - t2}ms)`);
for (const b of baum.slice(0, 6))
  console.log(`  Block ${b.nummer} – ${b.titel}: ${b.auftraege.length} LA, ${b.auftraege.flatMap(a=>a.aufgaben).length} Aufgaben`);
