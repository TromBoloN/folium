import { describe, expect, it } from "vitest";
import { breakSchema, extraSessionSchema, occurrenceKeySchema, occurrenceUpdateSchema } from "./schema";

const UUID = "0b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

describe("schedule schemas", () => {
  it("validates occurrence keys including real calendar dates", () => {
    expect(occurrenceKeySchema.safeParse(`s.${UUID}.2026-11-16`).success).toBe(true);
    expect(occurrenceKeySchema.safeParse(`x.${UUID}`).success).toBe(true);
    expect(occurrenceKeySchema.safeParse(`s.${UUID}.2026-02-30`).success).toBe(false);
    expect(occurrenceKeySchema.safeParse(`g.${UUID}.2026-11-16`).success).toBe(false);
  });

  it("requires endTime after startTime on moves and extra sessions", () => {
    const base = {
      key: `s.${UUID}.2026-11-16`,
      date: "2026-11-18",
      startTime: "10:00",
      endTime: "11:40",
      location: " B2.04 ",
      note: "",
      scope: "once",
    };
    expect(occurrenceUpdateSchema.parse(base)).toMatchObject({ location: "B2.04", note: null });
    expect(occurrenceUpdateSchema.safeParse({ ...base, endTime: "10:00" }).success).toBe(false);
    expect(occurrenceUpdateSchema.safeParse({ ...base, date: "2026-02-29" }).success).toBe(false);

    expect(
      extraSessionSchema.safeParse({
        courseId: UUID,
        date: "2026-11-20",
        startTime: "14:00",
        endTime: "13:00",
        location: "",
        label: "Makeup",
        note: "",
      }).success,
    ).toBe(false);
  });

  it("caps breaks at 120 days and rejects reversed dates", () => {
    expect(breakSchema.safeParse({ label: "Holiday", startsOn: "2026-11-23", endsOn: "2026-11-27" }).success).toBe(
      true,
    );
    expect(breakSchema.safeParse({ label: "Holiday", startsOn: "2026-11-27", endsOn: "2026-11-23" }).success).toBe(
      false,
    );
    expect(breakSchema.safeParse({ label: "Year off", startsOn: "2026-01-01", endsOn: "2026-06-01" }).success).toBe(
      false,
    );
  });
});
