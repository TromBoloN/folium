import type { IsoDate } from "./local-date";
import { parseAmount } from "./parse-amount";

/**
 * CSV import: parse, map columns, preview, dedupe. Bank formats are not
 * assumed; the user maps the columns. Every row gets an import key
 * (date|signed amount|payee, plus "#n" for the nth identical row in the file),
 * so importing the same file twice adds nothing (unique per account in SQL).
 */

/** RFC 4180-ish: quotes, doubled quotes, CRLF; the delimiter (, ; or tab) is guessed from the first line. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delimiter = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((v) => v.trim()));
}

export type DateFormat = "ymd" | "dmy" | "mdy";

/** "2026-11-05", "05/11/2026", "5-11-26 14:02" → ISO date, or null. */
export function parseDateCell(value: string, format: DateFormat): IsoDate | null {
  const m = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/.exec(value.trim());
  if (!m) return null;
  const [a, b, c] = [m[1], m[2], m[3]].map(Number);
  let [y, mo, d] = format === "ymd" ? [a, b, c] : format === "dmy" ? [c, b, a] : [c, a, b];
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** "-25.000", "(25.000)", "Rp 25.000,00", "25,000.00 CR" → signed rupiah, or null. Decimals must be zero. */
export function parseSignedCell(value: string): bigint | null {
  let text = value.trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/\b(DB|D|DR)$/i.test(text)) negative = true;
  text = text.replace(/\b(CR|DB|DR|D|K)$/i, "").trim();
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith("+")) text = text.slice(1);
  text = text.replace(/^rp\.?\s*/i, "").replace(/[.,]00$/, "");
  // "25,000" (comma thousands) → "25.000" for parseAmount.
  if (/^\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, ".");
  const parsed = parseAmount(text);
  if (!parsed.ok) return null;
  return negative ? -parsed.value : parsed.value;
}

export type Mapping = {
  date: number;
  /** One signed amount column… */
  amount?: number;
  /** …or separate money-out and money-in columns. */
  debit?: number;
  credit?: number;
  payee?: number;
  note?: number;
  dateFormat: DateFormat;
  /** When one amount column is positive for spending (most bank exports are signed: negative = out). */
  positiveIsExpense?: boolean;
};

export type ImportDraft = {
  line: number;
  occurredOn: IsoDate;
  kind: "expense" | "income";
  amount: bigint;
  payee: string | null;
  note: string | null;
  key: string;
};

export type MapResult = { drafts: ImportDraft[]; errors: { line: number; message: string }[] };

/** Rows (header excluded) → drafts with dedupe keys, plus per-line errors. */
export function mapRows(rows: readonly string[][], mapping: Mapping, firstLine = 2): MapResult {
  const drafts: ImportDraft[] = [];
  const errors: { line: number; message: string }[] = [];
  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    const line = firstLine + i;
    const date = parseDateCell(row[mapping.date] ?? "", mapping.dateFormat);
    if (!date) {
      errors.push({ line, message: `Can't read the date “${row[mapping.date] ?? ""}”.` });
      return;
    }
    let signed: bigint | null = null;
    if (mapping.amount !== undefined) {
      const v = parseSignedCell(row[mapping.amount] ?? "");
      signed = v === null ? null : mapping.positiveIsExpense ? -v : v;
    } else {
      const out = mapping.debit !== undefined ? parseSignedCell(row[mapping.debit] ?? "") : null;
      const inn = mapping.credit !== undefined ? parseSignedCell(row[mapping.credit] ?? "") : null;
      if (out !== null && out !== 0n) signed = -(out < 0n ? -out : out);
      else if (inn !== null && inn !== 0n) signed = inn < 0n ? -inn : inn;
    }
    if (signed === null || signed === 0n) {
      errors.push({ line, message: "No amount on this line." });
      return;
    }
    if (signed > BigInt(Number.MAX_SAFE_INTEGER) || -signed > BigInt(Number.MAX_SAFE_INTEGER)) {
      errors.push({ line, message: "That amount is too large." });
      return;
    }
    const payee = mapping.payee !== undefined ? (row[mapping.payee] ?? "").slice(0, 120) || null : null;
    const note = mapping.note !== undefined ? (row[mapping.note] ?? "").slice(0, 1000) || null : null;
    const base = `${date}|${signed}|${(payee ?? "").toLowerCase().replace(/\s+/g, " ")}`.slice(0, 290);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    drafts.push({
      line,
      occurredOn: date,
      kind: signed < 0n ? "expense" : "income",
      amount: signed < 0n ? -signed : signed,
      payee,
      note,
      key: n === 1 ? base : `${base}#${n}`,
    });
  });
  return { drafts, errors };
}

/** Guess the mapping from header names (English and Indonesian); the user can change it. */
export function guessMapping(header: readonly string[]): Partial<Mapping> {
  const find = (re: RegExp) => {
    const i = header.findIndex((h) => re.test(h.toLowerCase()));
    return i === -1 ? undefined : i;
  };
  return {
    date: find(/date|tanggal|tgl/),
    amount: find(/^amount$|jumlah|nominal|^amount|mutasi/),
    debit: find(/debit|debet|keluar|withdraw/),
    credit: find(/credit|kredit|masuk|deposit/),
    payee: find(/payee|description|keterangan|deskripsi|merchant|penerima/),
    note: find(/note|catatan|remark|berita/),
  };
}
