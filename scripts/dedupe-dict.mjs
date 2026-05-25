#!/usr/bin/env node
/* Remove duplicate keys within each top-level dictionary block in dictionary.ts.
 * Strategy: parse the file as raw text, split by `const xx: ... = {` ... `};` blocks,
 * and within each block keep only the FIRST occurrence of each key. */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "client/src/i18n/dictionary.ts";
const src = readFileSync(PATH, "utf8");

const blockRe = /(const\s+\w+(?:\s*:\s*[^=]+)?\s*=\s*\{)([\s\S]*?)(\n\};)/g;
let out = "";
let last = 0;
let match;
while ((match = blockRe.exec(src)) !== null) {
  out += src.slice(last, match.index);
  const head = match[1];
  const body = match[2];
  const tail = match[3];

  // Tokenize lines, keep multi-line string properties intact.
  const lines = body.split("\n");
  const kept = [];
  const seen = new Set();
  let pendingPropLines = [];
  let pendingKey = null;

  const flush = () => {
    if (pendingPropLines.length === 0) return;
    if (pendingKey === null) {
      // Comment / blank lines -> always keep
      kept.push(...pendingPropLines);
    } else if (seen.has(pendingKey)) {
      // duplicate -> drop
    } else {
      seen.add(pendingKey);
      kept.push(...pendingPropLines);
    }
    pendingPropLines = [];
    pendingKey = null;
  };

  for (const line of lines) {
    const m = line.match(/^\s*"([^"\\]+)"\s*:/);
    if (m) {
      flush();
      pendingKey = m[1];
      pendingPropLines.push(line);
    } else if (pendingKey !== null) {
      // Continuation of a multi-line value (e.g., string broken with `+`).
      pendingPropLines.push(line);
      // End of property = line ending with comma at the right depth.
      if (/,\s*$/.test(line)) {
        flush();
      }
    } else {
      // Comment / blank lines outside any property
      kept.push(line);
    }
  }
  flush();

  out += head + kept.join("\n") + tail;
  last = blockRe.lastIndex;
}
out += src.slice(last);

writeFileSync(PATH, out, "utf8");
console.log("Dedupe done.");
