import { matchByName } from "./parse-quick-transaction";

/**
 * Fixing a quick-add chip from its picker: rewrite the typed line so it names
 * the chosen account or category, using the shortest word that parses back to
 * exactly that item ("Livin' by Mandiri" → "@livin'").
 */

export type FixType = "account" | "toAccount" | "category";

export function tokenFor<T extends { id: string; name: string }>(item: T, items: readonly T[]): string {
  const words = item.name.trim().split(/\s+/);
  for (const word of words) {
    const m = matchByName(word, items);
    if (m.state === "matched" && m.item.id === item.id) return word.toLowerCase();
  }
  return words[0].toLowerCase();
}

const PATTERNS: Record<FixType, RegExp[]> = {
  account: [/(^|\s)@\S+/g, /(^|\s)from\s+\S+/gi],
  toAccount: [/(^|\s)to\s+\S+/gi],
  category: [/(^|\s)#\S+/g],
};

export function withToken(line: string, type: FixType, token: string): string {
  let text = line;
  for (const re of PATTERNS[type]) text = text.replace(re, " ");
  const prefix = type === "account" ? "@" : type === "category" ? "#" : "to ";
  return `${text.replace(/\s+/g, " ").trim()} ${prefix}${token}`.trim();
}
