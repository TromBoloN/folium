import { addDays, type CivilDate, isoWeekday } from "@/lib/dates";
import { appliesOn, compareSlots, type SlotTiming, toMinutes } from "../timetable/logic";

/**
 * THE schedule. Weekly slots are the default timetable; changes touch one date;
 * breaks cancel regular classes in a date range. `buildSchedule` merges them
 * into the classes that really happen in a date range, and every screen
 * (cards, by-day list, week grid, Today widgets, hero, overlap warnings,
 * attendance, calendar export) reads its output. Never merge them anywhere else.
 *
 * Rules, in order:
 *  1. A slot produces an occurrence on each date it applies (weekday + its own date range).
 *  2. A change for that occurrence (same slot, same original date) wins:
 *     cancelled -> cancelled; postponed -> postponed (not held, new date to be set);
 *     moved -> placed at the new date/time/room.
 *  3. Otherwise, if the date is inside a break, it's cancelled with the break's label.
 *     A room-only change inside a break is cancelled too (the class isn't held);
 *     a move to another date or time is explicit and wins over the break.
 *  4. Extra sessions always happen, breaks or not (an exam in exam week).
 *  5. A change whose slot no longer applies on its original date (the slot was
 *     edited or ended) is stale and ignored.
 *
 * Each occurrence is also a SlotTiming for its own date only (weekday of the
 * date, startsOn = endsOn = date), so the weekly helpers (sorting, overlap
 * lanes, conflicts, "now/next") work on occurrences unchanged.
 */

export type ScheduleCourse = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  room: string | null;
  lecturer?: string | null;
};

export type ScheduleSlot = SlotTiming & {
  courseId: string;
  location: string | null;
  course: ScheduleCourse;
  online?: boolean;
  meetingUrl?: string | null;
};

/** postponed: rescheduled, but the new date isn't decided yet (it later becomes moved or cancelled). */
export type ChangeKind = "cancelled" | "moved" | "extra" | "postponed";

export type ClassChange = {
  id: string;
  kind: ChangeKind;
  courseId: string;
  slotId: string | null;
  originalDate: CivilDate | null;
  newDate: CivilDate | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  label: string | null;
  note: string | null;
  /** Needed for extra sessions (they have no slot to take the course from). Null = archived/missing. */
  course?: ScheduleCourse | null;
};

export type ClassBreak = { id: string; label: string; startsOn: CivilDate; endsOn: CivilDate };

export type ScheduleInput = {
  slots: readonly ScheduleSlot[];
  changes: readonly ClassChange[];
  breaks: readonly ClassBreak[];
};

/**
 * scheduled  happens as in the weekly timetable (maybe in another room: see `room`)
 * moved      happens at another date and/or time (`from` is where it was)
 * extra      an extra session, not in the weekly timetable
 * cancelled  doesn't happen (`note`, or `breakLabel` when a break cancelled it)
 * postponed  won't happen on this date; rescheduled, new date not decided yet
 * ghost      where a moved class used to be (for the week grid; `movedTo` says where it went)
 */
export type OccurrenceStatus = "scheduled" | "moved" | "extra" | "cancelled" | "postponed" | "ghost";

export type Placement = { date: CivilDate; startTime: string; endTime: string };

export type Occurrence = SlotTiming & {
  /** Stable and URL-safe: "s.<slotId>.<originalDate>" for weekly classes, "x.<changeId>" for extras, "g.…" for ghosts. */
  key: string;
  status: OccurrenceStatus;
  date: CivilDate;
  courseId: string;
  course: ScheduleCourse;
  slotId: string | null;
  /** Weekly classes: the date it was scheduled for (attendance and changes are keyed by this). */
  originalDate: CivilDate | null;
  /** The change that shaped this occurrence, if any. */
  changeId: string | null;
  /** Effective room: change > slot > course. */
  location: string | null;
  /** Set when the room differs from the usual one. */
  room: { from: string | null; to: string } | null;
  /** moved: the original placement. */
  from: Placement | null;
  /** ghost: where the class went. */
  movedTo: Placement | null;
  note: string | null;
  /** extra: e.g. "Makeup", "Midterm exam". */
  label: string | null;
  /** cancelled by a break: the break's label. */
  breakLabel: string | null;
  online: boolean;
  meetingUrl: string | null;
};

export type DateRange = { from: CivilDate; to: CivilDate };

const inRange = (date: CivilDate, range: DateRange) => date >= range.from && date <= range.to;

export function occurrenceKey(slotId: string, originalDate: CivilDate) {
  return `s.${slotId}.${originalDate}`;
}

function base(slot: ScheduleSlot, date: CivilDate): Occurrence {
  return {
    key: occurrenceKey(slot.id, date),
    id: occurrenceKey(slot.id, date),
    status: "scheduled",
    date,
    weekday: isoWeekday(date),
    startTime: slot.startTime,
    endTime: slot.endTime,
    startsOn: date,
    endsOn: date,
    courseId: slot.courseId,
    course: slot.course,
    slotId: slot.id,
    originalDate: date,
    changeId: null,
    location: slot.location ?? slot.course.room,
    room: null,
    from: null,
    movedTo: null,
    note: null,
    label: null,
    breakLabel: null,
    online: slot.online ?? false,
    meetingUrl: slot.meetingUrl ?? null,
  };
}

/** Where a move puts the class; `timeChanged` is false for a room-only change. */
function placeMove(occ: Occurrence, change: ClassChange) {
  const date = change.newDate ?? occ.date;
  const startTime = change.startTime ?? occ.startTime;
  const endTime = change.endTime ?? occ.endTime;
  const timeChanged = date !== occ.date || startTime !== occ.startTime || endTime !== occ.endTime;
  return { date, startTime, endTime, timeChanged };
}

function withRoom(occ: Occurrence, change: ClassChange): Occurrence {
  if (!change.location || change.location === occ.location) return occ;
  return { ...occ, location: change.location, room: { from: occ.location, to: change.location } };
}

function moved(occ: Occurrence, change: ClassChange): Occurrence {
  const to = placeMove(occ, change);
  const placed: Occurrence = {
    ...occ,
    status: to.timeChanged ? "moved" : "scheduled",
    date: to.date,
    weekday: isoWeekday(to.date),
    startsOn: to.date,
    endsOn: to.date,
    startTime: to.startTime,
    endTime: to.endTime,
    changeId: change.id,
    note: change.note,
    from: to.timeChanged ? { date: occ.date, startTime: occ.startTime, endTime: occ.endTime } : null,
  };
  return withRoom(placed, change);
}

function cancelled(occ: Occurrence, extra: Partial<Occurrence>): Occurrence {
  return { ...occ, status: "cancelled", ...extra };
}

function datesIn(range: DateRange): CivilDate[] {
  const dates: CivilDate[] = [];
  // Guard against a reversed or absurd range: at most ~2 years of days.
  for (let d = range.from, i = 0; d <= range.to && i < 800; d = addDays(d, 1), i++) dates.push(d);
  return dates;
}

export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  return a.date.localeCompare(b.date) || compareSlots(a, b);
}

/** Every occurrence in the range (inclusive), sorted by date, start, end, key. Includes cancelled ones and ghosts. */
export function buildSchedule(input: ScheduleInput, range: DateRange): Occurrence[] {
  const slotById = new Map(input.slots.map((s) => [s.id, s]));
  const changeFor = new Map<string, ClassChange>();
  for (const c of input.changes) {
    if (c.kind !== "extra" && c.slotId && c.originalDate) changeFor.set(occurrenceKey(c.slotId, c.originalDate), c);
  }
  const breakOn = (date: CivilDate) => input.breaks.find((b) => date >= b.startsOn && date <= b.endsOn) ?? null;
  const out: Occurrence[] = [];

  // 1–3: weekly occurrences whose ORIGINAL date is in range.
  for (const date of datesIn(range)) {
    for (const slot of input.slots) {
      if (!appliesOn(slot, date)) continue;
      const occ = base(slot, date);
      const change = changeFor.get(occ.key);
      const brk = breakOn(date);
      if (change?.kind === "cancelled") {
        out.push(cancelled(occ, { changeId: change.id, note: change.note }));
      } else if (change?.kind === "postponed") {
        // Explicit, so it wins over a break (the student said it will happen another day).
        out.push({ ...occ, status: "postponed", changeId: change.id, note: change.note });
      } else if (change?.kind === "moved") {
        const placed = moved(occ, change);
        if (placed.status === "moved") {
          // The class itself is added below if its NEW date is in range; here, the ghost at the old spot.
          out.push({
            ...occ,
            key: `g.${slot.id}.${date}`,
            id: `g.${slot.id}.${date}`,
            status: "ghost",
            changeId: change.id,
            note: change.note,
            movedTo: { date: placed.date, startTime: placed.startTime, endTime: placed.endTime },
          });
        } else if (brk) {
          out.push(cancelled(occ, { breakLabel: brk.label }));
        } else {
          out.push(placed);
        }
      } else if (brk) {
        out.push(cancelled(occ, { breakLabel: brk.label }));
      } else {
        out.push(occ);
      }
    }
  }

  // 2: moved classes that land in range (wherever their original date is).
  for (const change of input.changes) {
    if (change.kind !== "moved" || !change.slotId || !change.originalDate) continue;
    const slot = slotById.get(change.slotId);
    if (!slot || !appliesOn(slot, change.originalDate)) continue; // 5: stale
    const placed = moved(base(slot, change.originalDate), change);
    if (placed.status === "moved" && inRange(placed.date, range)) out.push(placed);
  }

  // 4: extra sessions.
  for (const change of input.changes) {
    if (change.kind !== "extra" || !change.newDate || !change.startTime || !change.endTime) continue;
    if (!change.course || !inRange(change.newDate, range)) continue;
    const key = `x.${change.id}`;
    out.push({
      key,
      id: key,
      status: "extra",
      date: change.newDate,
      weekday: isoWeekday(change.newDate),
      startTime: change.startTime,
      endTime: change.endTime,
      startsOn: change.newDate,
      endsOn: change.newDate,
      courseId: change.courseId,
      course: change.course,
      slotId: null,
      originalDate: null,
      changeId: change.id,
      location: change.location ?? change.course.room,
      room: null,
      from: null,
      movedTo: null,
      note: change.note,
      label: change.label,
      breakLabel: null,
      online: false,
      meetingUrl: null,
    });
  }

  return out.sort(compareOccurrences);
}

// --- Reading the schedule ----------------------------------------------------

/** Happens: scheduled, moved or extra (not cancelled, not a ghost). */
export function isLive(o: Occurrence): boolean {
  return o.status === "scheduled" || o.status === "moved" || o.status === "extra";
}

/** Listed in day views: everything except ghosts (cancelled classes stay, dimmed). */
export function isListed(o: Occurrence): boolean {
  return o.status !== "ghost";
}

/** Anything that differs from the weekly timetable. */
export function isChanged(o: Occurrence): boolean {
  return o.status !== "scheduled" || o.room !== null;
}

/** How many listed occurrences differ from the weekly timetable, per course ("1 change this week"). */
export function changesByCourse(occurrences: readonly Occurrence[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of occurrences) {
    if (isListed(o) && isChanged(o)) counts.set(o.courseId, (counts.get(o.courseId) ?? 0) + 1);
  }
  return counts;
}

export function onDate(occurrences: readonly Occurrence[], date: CivilDate): Occurrence[] {
  return occurrences.filter((o) => o.date === date);
}

export function liveOn(occurrences: readonly Occurrence[], date: CivilDate): Occurrence[] {
  return occurrences.filter((o) => o.date === date && isLive(o));
}

/** The first live occurrence that hasn't ended yet, optionally for one course. */
export function nextOccurrence(
  occurrences: readonly Occurrence[],
  now: { date: CivilDate; minute: number },
  courseId?: string,
): Occurrence | null {
  return (
    occurrences.find(
      (o) =>
        isLive(o) &&
        (!courseId || o.courseId === courseId) &&
        (o.date > now.date || (o.date === now.date && toMinutes(o.endTime) > now.minute)),
    ) ?? null
  );
}

/** Whether the occurrence has finished by `now`. */
export function isPast(o: Pick<Occurrence, "date" | "endTime">, now: { date: CivilDate; minute: number }): boolean {
  return o.date < now.date || (o.date === now.date && toMinutes(o.endTime) <= now.minute);
}

/** Find one occurrence by key in a schedule built around it (see `rangeFor`). */
export function findOccurrence(occurrences: readonly Occurrence[], key: string): Occurrence | null {
  return occurrences.find((o) => o.key === key) ?? null;
}

/** "s.<uuid>.<date>" / "x.<uuid>" -> its parts; null for anything else. */
export function parseOccurrenceKey(
  key: string,
): { kind: "slot"; slotId: string; date: CivilDate } | { kind: "extra"; changeId: string } | null {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const slot = new RegExp(`^s\\.(${uuid})\\.(\\d{4}-\\d{2}-\\d{2})$`).exec(key);
  if (slot) return { kind: "slot", slotId: slot[1], date: slot[2] };
  const extra = new RegExp(`^x\\.(${uuid})$`).exec(key);
  if (extra) return { kind: "extra", changeId: extra[1] };
  return null;
}
