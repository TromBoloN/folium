/**
 * Colours and icons for accounts and categories. The swatches are what gets
 * stored (a #rrggbb per row); each has at least 3:1 contrast on a light card.
 * On screen they're never used raw for text or glyphs: CSS mixes them with the
 * foreground (`--money-ink`, see globals.css), which keeps AA in light and dark.
 */
export const MONEY_PALETTE = [
  { hex: "#c92a2a", name: "Red" },
  { hex: "#d9480f", name: "Orange" },
  { hex: "#d97706", name: "Amber" },
  { hex: "#a61e4d", name: "Pink" },
  { hex: "#862e9c", name: "Grape" },
  { hex: "#5f3dc4", name: "Violet" },
  { hex: "#364fc7", name: "Indigo" },
  { hex: "#1971c2", name: "Blue" },
  { hex: "#0c8599", name: "Cyan" },
  { hex: "#087f5b", name: "Teal" },
  { hex: "#2b8a3e", name: "Green" },
  { hex: "#5c940d", name: "Lime" },
  { hex: "#495057", name: "Grey" },
] as const;

/** Icon keys stored in `icon` (lucide names). The component maps each to its glyph. */
export const MONEY_ICONS = [
  "utensils",
  "coffee",
  "bus",
  "house",
  "graduation-cap",
  "repeat",
  "shopping-bag",
  "heart-pulse",
  "clapperboard",
  "book-open",
  "gift",
  "hand-coins",
  "award",
  "briefcase",
  "landmark",
  "wallet",
  "smartphone",
  "banknote",
  "piggy-bank",
  "receipt",
] as const;

export type MoneyIcon = (typeof MONEY_ICONS)[number];

export function isMoneyIcon(value: unknown): value is MoneyIcon {
  return typeof value === "string" && (MONEY_ICONS as readonly string[]).includes(value);
}

const GUESSES: [RegExp, MoneyIcon][] = [
  [/kopi|coffee|cafe/, "coffee"],
  [/food|makan|resto|warteg|kantin/, "utensils"],
  [/transport|ojek|grab|gojek|bus|bensin|fuel|parkir/, "bus"],
  [/kos|rent|sewa|house|rumah/, "house"],
  [/ukt|tuition|kuliah|spp|campus|kampus/, "graduation-cap"],
  [/subscri|langganan|netflix|spotify/, "repeat"],
  [/shop|belanja/, "shopping-bag"],
  [/health|sehat|obat|apotek|doctor|dokter/, "heart-pulse"],
  [/entertain|hiburan|movie|film|game/, "clapperboard"],
  [/book|buku/, "book-open"],
  [/gift|hadiah/, "gift"],
  [/allowance|uang saku|kiriman/, "hand-coins"],
  [/scholar|beasiswa/, "award"],
  [/part.?time|salary|gaji|kerja|freelance|les/, "briefcase"],
];

/** The stored icon if valid, else a guess from the name, else null (the caller falls back by kind). */
export function iconFor(stored: string | null | undefined, name: string): MoneyIcon | null {
  if (isMoneyIcon(stored)) return stored;
  const n = name.toLowerCase();
  return GUESSES.find(([re]) => re.test(n))?.[1] ?? null;
}
