import { contrastRatio, oklchToHex } from "@/lib/color";
import type { ThemeManifest } from "./manifest";

/**
 * Checks a theme pack's CSS against the rules in docs/themes.md. Pure, so the
 * tests run it on every pack (packs.test.ts) and on known-bad samples.
 * It's a small CSS reader, not a full parser: it understands rules, at-rules
 * (@media, @supports, @container, @keyframes) and declarations, which is all a
 * pack should contain.
 */

export type LintIssue = { rule: string; message: string };

type Rule =
  | { kind: "style"; selector: string; declarations: Declaration[]; children: Rule[] }
  | { kind: "keyframes"; name: string; frames: { selector: string; declarations: Declaration[] }[] }
  | { kind: "group"; prelude: string; children: Rule[] };

type Declaration = { property: string; value: string };

/** Animatable without layout or paint work (project rule: transform and opacity only). */
const KEYFRAME_PROPERTIES = new Set(["transform", "opacity", "animation-timing-function"]);
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(/i;
const NAMED_COLOR =
  /\b(?:white|black|red|green|blue|yellow|orange|purple|pink|cyan|magenta|gr[ae]y|silver|gold|navy|teal|lime|maroon|olive|aqua|fuchsia|crimson)\b/i;

/** Tokens a "custom" palette must set itself (the rest may derive from --hue). */
export const REQUIRED_CUSTOM_TOKENS = [
  "--surface-0",
  "--surface-1",
  "--surface-2",
  "--foreground",
  "--muted-foreground",
  "--primary",
  "--primary-foreground",
  "--border",
  "--ring",
] as const;

/** [text, background] pairs that must reach 4.5:1 in every scheme the pack supports. */
export const CONTRAST_PAIRS = [
  ["--foreground", "--surface-0"],
  ["--foreground", "--surface-1"],
  ["--muted-foreground", "--surface-1"],
  ["--primary-foreground", "--primary"],
] as const;

/**
 * Layout properties a pack may not set on the app's elements. Exempt: pseudo-elements
 * and the pack's own elements (classes named `<id>-…`, e.g. effect particles), which are
 * decoration. A layout problem under one pack is an app bug: fix it in the component or
 * globals.css, for every pack. A real exception carries a `/* layout-ok: reason *\/`
 * comment on the declaration.
 */
const LAYOUT_PROPERTY =
  /^(?:display|position|float|(?:min-|max-)?(?:width|height)|(?:min-|max-)?(?:inline|block)-size|margin(?:-.+)?|padding(?:-.+)?|gap|row-gap|column-gap|inset(?:-.+)?|top|right|bottom|left|flex(?:-.+)?|grid(?:-.+)?|order|font-size|align-(?:items|self|content)|justify-(?:items|self|content)|place-(?:items|self|content))$/;
const LAYOUT_OK = "__layout_ok__";

function stripComments(css: string) {
  return css.replace(/\/\*\s*layout-ok:[\s\S]*?\*\//g, ` ${LAYOUT_OK}`).replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Does the selector style decoration the pack owns: a pseudo-element (`::before`,
 * `::view-transition-new(…)`) or one of its own elements (`.<id>-rain`)?
 */
function targetsPackDecoration(id: string, selector: string) {
  const last =
    selector
      .split(/\s+|>|\+|~/)
      .filter(Boolean)
      .at(-1) ?? "";
  return last.includes("::") || new RegExp(`\\.${id}-[\\w-]`).test(last);
}

function parseDeclarations(body: string): Declaration[] {
  const out: Declaration[] = [];
  // Split on ; outside parentheses (data: URLs and gradients contain ; and :).
  let depth = 0;
  let start = 0;
  const parts: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const property = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (property) out.push({ property, value });
  }
  return out;
}

/** Parse a block's contents into rules. Declarations directly in a style rule are collected on it. */
function parseBlock(css: string): { rules: Rule[]; declarations: string } {
  const rules: Rule[] = [];
  let loose = "";
  let i = 0;
  let preludeStart = 0;
  let parenDepth = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    else if (ch === ";" && parenDepth === 0) {
      loose += `${css.slice(preludeStart, i)};`;
      preludeStart = i + 1;
    } else if (ch === "{" && parenDepth === 0) {
      const prelude = css.slice(preludeStart, i).trim();
      // Find the matching close brace.
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      const body = css.slice(i + 1, j - 1);
      rules.push(toRule(prelude, body));
      i = j;
      preludeStart = j;
      continue;
    }
    i++;
  }
  loose += css.slice(preludeStart);
  return { rules, declarations: loose };
}

function toRule(prelude: string, body: string): Rule {
  const keyframes = prelude.match(/^@(?:-webkit-)?keyframes\s+([\w-]+)/);
  if (keyframes) {
    const { rules } = parseBlock(body);
    return {
      kind: "keyframes",
      name: keyframes[1],
      frames: rules.flatMap((r) =>
        r.kind === "style" ? [{ selector: r.selector, declarations: r.declarations }] : [],
      ),
    };
  }
  if (prelude.startsWith("@")) return { kind: "group", prelude, children: parseBlock(body).rules };
  const { rules, declarations } = parseBlock(body);
  return { kind: "style", selector: prelude, declarations: parseDeclarations(declarations), children: rules };
}

export function parseCss(css: string): Rule[] {
  return parseBlock(stripComments(css)).rules;
}

function* styleRules(rules: Rule[]): Generator<Extract<Rule, { kind: "style" }>> {
  for (const rule of rules) {
    if (rule.kind === "style") {
      yield rule;
      yield* styleRules(rule.children);
    } else if (rule.kind === "group") yield* styleRules(rule.children);
  }
}

function* keyframeRules(rules: Rule[]): Generator<Extract<Rule, { kind: "keyframes" }>> {
  for (const rule of rules) {
    if (rule.kind === "keyframes") yield rule;
    else if (rule.kind === "group") yield* keyframeRules(rule.children);
  }
}

/** Selector list → selectors, splitting on commas outside brackets and parentheses. */
function splitSelectors(selector: string) {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      out.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(selector.slice(start).trim());
  return out.filter(Boolean);
}

/** The value with url(...) contents and custom-property names removed, so neither looks like a colour. */
function colourCheckable(value: string) {
  return value.replace(/url\([^)]*\)/g, "url()").replace(/--[\w-]+/g, "");
}

export function lintPackCss(id: string, css: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const rules = parseCss(css);
  const scope = `[data-theme="${id}"]`;

  for (const rule of styleRules(rules)) {
    // Nested rules (CSS nesting) are already inside a scoped parent.
    const topLevel = rules.includes(rule) || isInGroupOnly(rules, rule);
    if (topLevel) {
      for (const selector of splitSelectors(rule.selector)) {
        if (!selector.startsWith(scope) && !selector.startsWith(`:root${scope}`)) {
          issues.push({ rule: "scope", message: `Selector "${selector}" must start with ${scope}.` });
        }
      }
    }
    const appElement = splitSelectors(rule.selector).some((s) => !targetsPackDecoration(id, s));
    for (const { property, value } of rule.declarations) {
      if (property.startsWith("--")) continue;
      if (appElement && LAYOUT_PROPERTY.test(property) && !value.includes(LAYOUT_OK)) {
        issues.push({
          rule: "layout",
          message: `"${rule.selector} { ${property} }" changes layout. Packs only restyle: fix layout in the component or globals.css for every pack (docs/themes.md, "Theme bug or app bug?").`,
        });
      }
      const checkable = colourCheckable(value).replace(LAYOUT_OK, "");
      if (COLOR_LITERAL.test(checkable) || NAMED_COLOR.test(checkable)) {
        issues.push({
          rule: "colour",
          message: `"${property}: ${value}" uses a colour directly. Put colours in tokens (--x: oklch(...)) and use var(--x).`,
        });
      }
    }
  }

  for (const keyframes of keyframeRules(rules)) {
    if (!keyframes.name.startsWith(`${id}-`)) {
      issues.push({ rule: "keyframes-name", message: `@keyframes ${keyframes.name} must be named "${id}-…".` });
    }
    for (const frame of keyframes.frames) {
      for (const { property } of frame.declarations) {
        if (!KEYFRAME_PROPERTIES.has(property)) {
          issues.push({
            rule: "keyframes-property",
            message: `@keyframes ${keyframes.name} animates "${property}"; only transform and opacity may animate.`,
          });
        }
      }
    }
  }
  return issues;
}

/** A rule that sits at the top level or only inside @media/@supports (not nested in another style rule). */
function isInGroupOnly(rules: Rule[], target: Rule): boolean {
  for (const rule of rules) {
    if (rule.kind === "group") {
      if (rule.children.includes(target) || isInGroupOnly(rule.children, target)) return true;
    }
  }
  return false;
}

/** Token declarations on the pack's root rule (`[data-theme="id"]` on its own). */
export function rootTokens(id: string, css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const rule of styleRules(parseCss(css))) {
    const selectors = splitSelectors(rule.selector);
    if (!selectors.some((s) => s === `[data-theme="${id}"]` || s === `:root[data-theme="${id}"]`)) continue;
    for (const { property, value } of rule.declarations) if (property.startsWith("--")) tokens.set(property, value);
  }
  return tokens;
}

const OKLCH = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)/;

/** A literal token value → { light, dark } hex, or null when it isn't literal oklch (var(), color-mix…). */
export function resolveLiteral(value: string): { light: string; dark: string } | null {
  const toHex = (text: string) => {
    const m = text.match(OKLCH);
    if (!m) return null;
    const l = m[1].endsWith("%") ? Number.parseFloat(m[1]) / 100 : Number(m[1]);
    return oklchToHex(l, Number(m[2]), Number(m[3]));
  };
  const lightDark = value.match(/^light-dark\(\s*(oklch\([^)]*\))\s*,\s*(oklch\([^)]*\))\s*\)$/);
  if (lightDark) {
    const light = toHex(lightDark[1]);
    const dark = toHex(lightDark[2]);
    return light && dark ? { light, dark } : null;
  }
  if (!/^oklch\([^)]*\)$/.test(value.trim())) return null;
  const hex = toHex(value);
  return hex ? { light: hex, dark: hex } : null;
}

/** For "custom" palettes: required tokens are set as literal oklch and the key pairs reach 4.5:1. */
export function lintPalette(manifest: ThemeManifest, css: string): LintIssue[] {
  if (manifest.palette !== "custom") return [];
  const issues: LintIssue[] = [];
  const tokens = rootTokens(manifest.id, css);
  const resolved = new Map<string, { light: string; dark: string }>();
  for (const name of REQUIRED_CUSTOM_TOKENS) {
    const value = tokens.get(name);
    const literal = value ? resolveLiteral(value) : null;
    if (!literal) {
      issues.push({
        rule: "palette",
        message: `${name} must be set on [data-theme="${manifest.id}"] as oklch(...) or light-dark(oklch(...), oklch(...)).`,
      });
    } else resolved.set(name, literal);
  }
  const schemes = manifest.scheme === "both" ? (["light", "dark"] as const) : ([manifest.scheme] as const);
  for (const [text, background] of CONTRAST_PAIRS) {
    const fg = resolved.get(text);
    const bg = resolved.get(background);
    if (!fg || !bg) continue;
    for (const scheme of schemes) {
      const ratio = contrastRatio(fg[scheme], bg[scheme]);
      if (ratio < 4.5) {
        issues.push({
          rule: "contrast",
          message: `${text} on ${background} is ${ratio.toFixed(2)}:1 in ${scheme} mode; it needs 4.5:1.`,
        });
      }
    }
  }
  return issues;
}
