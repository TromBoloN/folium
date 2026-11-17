import { describe, expect, it } from "vitest";
import { slotInputSchema } from "../timetable/schema";
import {
  COURSE_COLORS,
  canonicalSemester,
  courseInputSchema,
  nextCourseColor,
  nextSemesterName,
  normalizeCourse,
  semesterLabels,
  whatsappLink,
} from "./schema";

describe("courseInputSchema", () => {
  it("trims text and turns empty optional fields into null", () => {
    expect(
      courseInputSchema.parse({ name: "  Calculus ", code: "", color: "#2F9E44", lecturer: " Dr. Ana ", room: "" }),
    ).toEqual({
      name: "Calculus",
      code: null,
      color: "#2f9e44",
      lecturer: "Dr. Ana",
      room: null,
      semester: null,
      credits: 0,
      lecturerEmail: null,
      lecturerPhone: null,
      kind: "campus",
      classType: null,
      totalMeetings: null,
      currentMeeting: null,
    });
  });

  it("checks the lecturer's email and phone", () => {
    const base = { name: "Calculus", color: "#2f9e44" };
    expect(courseInputSchema.safeParse({ ...base, lecturerEmail: "siti@campus.ac.id" }).success).toBe(true);
    expect(courseInputSchema.safeParse({ ...base, lecturerEmail: "not an email" }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...base, lecturerPhone: "+62 812-3456 7890" }).success).toBe(true);
    expect(courseInputSchema.safeParse({ ...base, lecturerPhone: "call me" }).success).toBe(false);
  });

  it("requires a name and a valid colour", () => {
    const result = courseInputSchema.safeParse({ name: "   ", color: "green" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual(["color", "name"]);
  });
});

describe("nextCourseColor", () => {
  it("picks the first unused suggestion", () => {
    expect(nextCourseColor([])).toBe(COURSE_COLORS[0]);
    expect(nextCourseColor([COURSE_COLORS[0].toUpperCase()])).toBe(COURSE_COLORS[1]);
  });

  it("cycles once every suggestion is used", () => {
    expect(COURSE_COLORS).toContain(nextCourseColor([...COURSE_COLORS]));
  });
});

describe("slotInputSchema", () => {
  const base = {
    courseId: "4f9b2c1e-8d3a-4b6f-9e2d-1a2b3c4d5e6f",
    weekday: "1",
    startTime: "08:00",
    endTime: "09:40",
    location: "",
    startsOn: "",
    endsOn: "",
  };

  it("parses a form submission", () => {
    expect(slotInputSchema.parse(base)).toEqual({
      ...base,
      weekday: 1,
      location: null,
      startsOn: null,
      endsOn: null,
      online: false,
      meetingUrl: null,
    });
  });

  it("takes an online flag and only http(s) meeting links", () => {
    expect(slotInputSchema.parse({ ...base, online: "on", meetingUrl: " https://meet.example/abc " })).toMatchObject({
      online: true,
      meetingUrl: "https://meet.example/abc",
    });
    expect(slotInputSchema.safeParse({ ...base, meetingUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("accepts times with seconds from the database", () => {
    expect(slotInputSchema.parse({ ...base, startTime: "08:00:00" }).startTime).toBe("08:00");
  });

  it("rejects an end time before or equal to the start, on the end field", () => {
    for (const endTime of ["07:00", "08:00"]) {
      const result = slotInputSchema.safeParse({ ...base, endTime });
      expect(result.error?.issues[0].path).toEqual(["endTime"]);
    }
  });

  it("rejects a date range that ends before it starts", () => {
    const result = slotInputSchema.safeParse({ ...base, startsOn: "2026-12-01", endsOn: "2026-11-01" });
    expect(result.error?.issues[0].path).toEqual(["endsOn"]);
  });

  it("rejects impossible dates and out-of-range weekdays", () => {
    expect(slotInputSchema.safeParse({ ...base, startsOn: "2026-02-30" }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...base, weekday: "8" }).success).toBe(false);
  });
});

describe("course credits", () => {
  const base = { name: "Calculus", color: "#2f9e44" };
  it("parses form strings and defaults blank to 0", () => {
    expect(courseInputSchema.parse({ ...base, credits: "3" }).credits).toBe(3);
    expect(courseInputSchema.parse({ ...base, credits: "2.5" }).credits).toBe(2.5);
    expect(courseInputSchema.parse({ ...base, credits: "" }).credits).toBe(0);
  });

  it.each([["-1"], ["25"], ["abc"], ["1.25"]])("rejects %s", (credits) => {
    expect(courseInputSchema.safeParse({ ...base, credits }).success).toBe(false);
  });
});

describe("nextSemesterName and whatsappLink", () => {
  it("rolls Indonesian semester names forward", () => {
    expect(nextSemesterName("2026 Ganjil")).toBe("2026 Genap");
    expect(nextSemesterName("2026 genap")).toBe("2027 Ganjil");
    expect(nextSemesterName("Fall 2026")).toBe("");
  });
  it("turns a local Indonesian number into an international wa.me link", () => {
    expect(whatsappLink("0812-3456-7890")).toBe("https://wa.me/6281234567890");
    expect(whatsappLink("+62 812 3456 7890")).toBe("https://wa.me/6281234567890");
    expect(whatsappLink("+44 20 7946 0958")).toBe("https://wa.me/442079460958");
  });
});

describe("semesters", () => {
  it("reuses an existing spelling, ignoring case and spaces", () => {
    expect(canonicalSemester("2026  ganjil ", ["2026 Ganjil", null])).toBe("2026 Ganjil");
    expect(canonicalSemester(" 2027 Genap ", ["2026 Ganjil"])).toBe("2027 Genap");
    expect(canonicalSemester("   ", ["2026 Ganjil"])).toBeNull();
    expect(canonicalSemester(null, ["2026 Ganjil"])).toBeNull();
  });
  it("lists labels by how many courses use them", () => {
    expect(
      semesterLabels([
        { semester: "2026 Genap" },
        { semester: "2026 Ganjil" },
        { semester: "2026 Ganjil" },
        { semester: null },
      ]),
    ).toEqual(["2026 Ganjil", "2026 Genap"]);
  });
});

describe("links in course and class-time forms", () => {
  const course = { name: "Calculus", color: "#2f9e44" };
  const slot = { courseId: "0b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b", weekday: "1", startTime: "08:00", endTime: "09:40" };

  it("meeting links must be https; javascript:, data: and http are rejected", () => {
    for (const meetingUrl of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "data:text/html;base64,PHNjcmlwdD4=",
      "http://meet.example/abc",
      "https://meet.example/a\nb",
    ]) {
      const result = slotInputSchema.safeParse({ ...slot, meetingUrl });
      expect(result.success, meetingUrl).toBe(false);
      expect(result.error?.issues[0].path).toEqual(["meetingUrl"]);
    }
    expect(slotInputSchema.parse({ ...slot, meetingUrl: "https://Meet.Google.com/abc" }).meetingUrl).toBe(
      "https://meet.google.com/abc",
    );
  });

  it("WhatsApp numbers are stored as digits (with an optional +); anything else is rejected", () => {
    expect(courseInputSchema.parse({ ...course, lecturerPhone: "+62 812-3456 (7890)" }).lecturerPhone).toBe(
      "+6281234567890",
    );
    for (const lecturerPhone of ["javascript:alert(1)", "data:text/plain,0812", "0812;3456", "call me"]) {
      expect(courseInputSchema.safeParse({ ...course, lecturerPhone }).success, lecturerPhone).toBe(false);
    }
  });

  it("emails are plain addresses: no schemes, no mailto parameters", () => {
    for (const lecturerEmail of [
      "javascript:alert(1)@x.co",
      "data:text/html,a@b.co",
      "a@b.co?cc=c@d.co",
      "a@b.co&body=x",
    ]) {
      expect(courseInputSchema.safeParse({ ...course, lecturerEmail }).success, lecturerEmail).toBe(false);
    }
  });
});

describe("normalizeCourse (kind, class type, meetings)", () => {
  const types = [
    { id: "regular", meetings: 16 },
    { id: "practicum", meetings: 8 },
  ];
  const input = (extra: Record<string, unknown>) =>
    courseInputSchema.parse({ name: "Fisika", color: "#2f9e44", ...extra });

  it("takes the class type's meeting count when none is typed, and keeps an override", () => {
    const fromType = normalizeCourse(input({ classType: "practicum" }), types);
    expect(fromType.ok && fromType.value.totalMeetings).toBe(8);
    const override = normalizeCourse(input({ classType: "practicum", totalMeetings: "10" }), types);
    expect(override.ok && override.value.totalMeetings).toBe(10);
  });

  it("an external course drops credits, semester and type, and can be open-ended", () => {
    const r = normalizeCourse(
      input({ kind: "external", credits: "3", semester: "2026 Ganjil", classType: "regular", totalMeetings: "" }),
      types,
    );
    expect(r.ok && r.value).toMatchObject({ credits: 0, semester: null, classType: null, totalMeetings: null });
  });

  it("rejects an unknown type and a current meeting past the end", () => {
    expect(normalizeCourse(input({ classType: "gone" }), types)).toMatchObject({ ok: false, field: "classType" });
    expect(normalizeCourse(input({ totalMeetings: "8", currentMeeting: "9" }), types)).toMatchObject({
      ok: false,
      field: "currentMeeting",
    });
  });
});
