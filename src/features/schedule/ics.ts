import { safeHttpsUrl } from "@/lib/safe-links";
import { dueAtFrom } from "../tasks/due";
import { isLive, type Occurrence } from "./occurrences";

/**
 * An iCalendar file (RFC 5545) of the classes that really happen: changes and
 * breaks applied, cancelled classes left out. Times are written in UTC, so no
 * VTIMEZONE block is needed. UIDs are the occurrence keys, so importing a newer
 * file updates the same events instead of duplicating them.
 */

/** "2026-11-16T00:30:00.000Z" -> "20261116T003000Z". */
function icsUtc(iso: string) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape text values: backslash, semicolon, comma, newline. */
export function escapeText(value: string) {
  return (
    value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      // CRLF, LF and a lone CR are all line breaks; none may reach the file raw.
      .replace(/\r\n|\r|\n/g, "\\n")
      // Other control characters aren't allowed in TEXT values (RFC 5545 3.3.11).
      // biome-ignore lint/suspicious/noControlCharactersInRegex: removing control characters is the point.
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
  );
}

/** Lines longer than 75 octets are folded: CRLF + one space. */
export function foldLine(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    if (size + n > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(
  occurrences: readonly Occurrence[],
  options: { timeZone: string; stamp: Date; host: string },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Folium//Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Folium classes",
  ];
  const stamp = icsUtc(options.stamp.toISOString());
  for (const o of occurrences) {
    if (!isLive(o)) continue;
    const start = icsUtc(dueAtFrom(o.date, o.startTime, options.timeZone));
    const end = icsUtc(dueAtFrom(o.date, o.endTime, options.timeZone));
    const summary = o.status === "extra" && o.label ? `${o.course.name} (${o.label})` : o.course.name;
    const notes: string[] = [];
    if (o.course.code) notes.push(o.course.code);
    if (o.status === "moved" && o.from) notes.push(`Moved from ${o.from.date} ${o.from.startTime}`);
    if (o.room) notes.push(`Room changed from ${o.room.from ?? "the usual room"}`);
    if (o.note) notes.push(o.note);
    const url = safeHttpsUrl(o.meetingUrl);
    if (url) notes.push(url);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${o.key}@${options.host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(summary)}`,
    );
    if (o.location) lines.push(`LOCATION:${escapeText(o.location)}`);
    if (notes.length) lines.push(`DESCRIPTION:${escapeText(notes.join("\n"))}`);
    // URL is a URI value, not TEXT: it isn't escaped, so only a safe https link (no line breaks) goes in.
    if (url) lines.push(`URL:${url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
