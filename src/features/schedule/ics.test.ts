import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "./ics";
import { buildSchedule, type ClassChange, type ScheduleSlot } from "./occurrences";

const COURSE = { id: "c", name: "Calculus I", code: "MAT101", color: "#1c7ed6", room: "B2.04" };
const mon: ScheduleSlot = {
  id: "s",
  courseId: "c",
  course: COURSE,
  weekday: 1,
  startTime: "07:30",
  endTime: "09:10",
  startsOn: null,
  endsOn: null,
  location: null,
};
const change = (partial: Partial<ClassChange>): ClassChange => ({
  id: "ch",
  kind: "cancelled",
  courseId: "c",
  slotId: "s",
  originalDate: "2026-11-23",
  newDate: null,
  startTime: null,
  endTime: null,
  location: null,
  label: null,
  note: null,
  ...partial,
});
const options = { timeZone: "Asia/Makassar", stamp: new Date("2026-11-15T00:00:00Z"), host: "folium.test" };

describe("buildIcs", () => {
  it("writes each class in UTC with a stable UID, and leaves cancelled ones out", () => {
    const occ = buildSchedule(
      { slots: [mon], changes: [change({ note: "Ill" })], breaks: [] },
      { from: "2026-11-16", to: "2026-11-29" },
    );
    const ics = buildIcs(occ, options);
    // Makassar is UTC+8: 07:30 local = 23:30 the day before in UTC.
    expect(ics).toContain("DTSTART:20261115T233000Z");
    expect(ics).toContain("DTEND:20261116T011000Z");
    expect(ics).toContain("UID:s.s.2026-11-16@folium.test");
    expect(ics).not.toContain("2026-11-23@");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("puts a moved class at its new time and says where it came from", () => {
    const occ = buildSchedule(
      {
        slots: [mon],
        changes: [
          change({ kind: "moved", newDate: "2026-11-24", startTime: "10:00", endTime: "11:40", location: "B2.05" }),
        ],
        breaks: [],
      },
      { from: "2026-11-23", to: "2026-11-29" },
    );
    const ics = buildIcs(occ, options);
    expect(ics).toContain("DTSTART:20261124T020000Z");
    expect(ics).toContain("LOCATION:B2.05");
    expect(ics).toContain("Moved from 2026-11-23 07:30");
  });

  it("escapes and folds text", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const long = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldLine(long);
    expect(folded.split("\r\n ").every((part) => new TextEncoder().encode(part).length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });
});

describe("escaping in the .ics output", () => {
  it("escapes each special character in TEXT values", () => {
    expect(escapeText("a,b")).toBe("a\\,b");
    expect(escapeText("a;b")).toBe(String.raw`a\;b`);
    expect(escapeText("a\\b")).toBe("a\\\\b");
    expect(escapeText("a\nb")).toBe("a\\nb");
    expect(escapeText("a\r\nb")).toBe("a\\nb");
    expect(escapeText("a\rb")).toBe("a\\nb");
    // The backslash is escaped first, so an escape sequence typed by the user stays literal.
    expect(escapeText("\\n")).toBe("\\\\n");
    expect(escapeText("a\u0000b\u0007c\tdone")).toBe("abc\tdone");
  });

  it("a note, room or name can't break out of its line", () => {
    const hostile: ScheduleSlot = {
      ...mon,
      course: { ...COURSE, name: "Calc; I, \\ part\nBEGIN:VEVENT" },
      location: "B2.04\r\nATTENDEE:mailto:x@y.z",
      meetingUrl: "https://meet.example/a\nURL:javascript:alert(1)",
    };
    const occ = buildSchedule(
      {
        slots: [hostile],
        changes: [change({ kind: "moved", location: "B1\rX:Y", note: "x\r\nEND:VCALENDAR" })],
        breaks: [],
      },
      { from: "2026-11-23", to: "2026-11-23" },
    );
    const ics = buildIcs(occ, options);
    // Every physical line is a property, a folded continuation, or a BEGIN/END we wrote.
    const lines = ics.split("\r\n").filter(Boolean);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines.filter((l) => l === "END:VCALENDAR")).toHaveLength(1);
    expect(lines.some((l) => l.startsWith("ATTENDEE"))).toBe(false);
    expect(ics).toContain(String.raw`SUMMARY:Calc\; I\, \\ part\nBEGIN:VEVENT`);
    expect(ics).toContain("LOCATION:B1\\nX:Y");
    // A meeting link with a line break isn't a safe https link: no URL line at all.
    expect(lines.some((l) => l.startsWith("URL:"))).toBe(false);
    expect(ics).not.toContain("javascript");
  });

  it("keeps a safe meeting link as the URL", () => {
    const online: ScheduleSlot = { ...mon, online: true, meetingUrl: "https://meet.example/abc-defg" };
    const ics = buildIcs(
      buildSchedule({ slots: [online], changes: [], breaks: [] }, { from: "2026-11-16", to: "2026-11-16" }),
      options,
    );
    expect(ics).toContain("URL:https://meet.example/abc-defg");
  });

  it("drops javascript: and data: meeting links", () => {
    for (const meetingUrl of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://meet.example/x",
    ]) {
      const ics = buildIcs(
        buildSchedule(
          { slots: [{ ...mon, meetingUrl }], changes: [], breaks: [] },
          { from: "2026-11-16", to: "2026-11-16" },
        ),
        options,
      );
      expect(ics, meetingUrl).not.toContain("URL:");
      expect(ics, meetingUrl).not.toContain(meetingUrl.slice(0, 10));
    }
  });
});
