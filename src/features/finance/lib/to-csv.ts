export type CsvCell = string | number | bigint | null | undefined;

/** Text that a spreadsheet would run as a formula ("=SUM(…)", "+1", "-1", "@cmd"). */
const FORMULA_START = /^[=+\-@]/;

/**
 * RFC 4180 CSV: records separated by CRLF; a field containing a comma, quote,
 * CR or LF is quoted, with quotes doubled. Text cells starting with = + - @ get
 * a leading apostrophe so a spreadsheet shows them as text instead of running
 * them (formula injection). Numbers and bigints are written as-is, so a
 * negative amount stays a number. null/undefined become an empty field.
 */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint" || typeof value === "number") return String(value);
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
