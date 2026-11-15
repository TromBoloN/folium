import { describe, expect, it } from "vitest";
import { slotInputSchema } from "../timetable/schema";
import { COURSE_COLORS, courseInputSchema, nextCourseColor, nextSemesterName, whatsappLink } from "./schema";

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
