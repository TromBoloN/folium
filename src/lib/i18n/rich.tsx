import { Fragment, type ReactNode } from "react";

/**
 * Put elements into translated text: `rich(t("Signed in as {email}"), { email: <b>{email}</b> })`.
 * `t` leaves placeholders it wasn't given, so they survive to be replaced here.
 */
export function rich(text: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = text.split(/\{(\w+)\}/g);
  // split with a capture group: odd indexes are placeholder names.
  return parts.map((part, i) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: the parts are fixed for a given text.
    i % 2 === 1 && part in nodes ? <Fragment key={i}>{nodes[part]}</Fragment> : part,
  );
}
