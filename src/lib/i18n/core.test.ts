import { describe, expect, it } from "vitest";
import { weekdayLabel } from "@/features/timetable/logic";
import { formatDate } from "@/lib/dates";
import { i18nFor, interpolate, makeT, plural, tEn, translateLoose } from "./core";
import { id } from "./id";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("English returns the key, filled in", () => {
    expect(tEn("Due {when}", { when: "Mon 16" })).toBe("Due Mon 16");
  });

  it("Indonesian uses the dictionary", () => {
    expect(makeT("id")("Due {when}", { when: "Sen 16" })).toBe("Jatuh tempo Sen 16");
    expect(makeT("id")("Settings")).toBe("Pengaturan");
  });

  it("every Indonesian entry keeps exactly the placeholders of its key", () => {
    const broken = Object.entries(id).filter(([key, value]) => placeholders(key).join() !== placeholders(value).join());
    expect(broken).toEqual([]);
  });

  it("leaves unknown placeholders for rich() to fill", () => {
    expect(interpolate("Hi {name}, see {link}", { name: "Dewi" })).toBe("Hi Dewi, see {link}");
  });

  it("picks the plural key", () => {
    expect(plural(1, "{n} class", "{n} classes")).toBe("{n} class");
    expect(plural(3, "{n} class", "{n} classes")).toBe("{n} classes");
  });

  it("translates server messages loosely, including ones with values", () => {
    expect(translateLoose("id", "Enter a valid date.")).toBe("Masukkan tanggal yang valid.");
    expect(translateLoose("id", "Room can be at most 80 characters.")).toBe("Ruangan maksimal 80 karakter.");
    expect(translateLoose("id", "3 class times added")).toBe("3 jadwal kelas ditambahkan");
    expect(translateLoose("id", "Something only the user typed")).toBe("Something only the user typed");
    expect(translateLoose("en", "Enter a valid date.")).toBe("Enter a valid date.");
  });

  it("formats dates and weekdays in the user's language", () => {
    const { intl } = i18nFor("id");
    expect(formatDate("2026-11-16", { weekday: "long", day: "numeric", month: "long" }, intl)).toBe(
      "Senin, 16 November",
    );
    expect(weekdayLabel(1, "label", intl)).toBe("Senin");
    expect(weekdayLabel(7, "short", "en-GB")).toBe("Sun");
  });
});
