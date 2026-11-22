import { describe, expect, it } from "vitest";
import { fetchAllPages, PAGE_SIZE } from "./paginate";

describe("fetchAllPages", () => {
  it("fetches every page until a page comes back short", async () => {
    const total = PAGE_SIZE * 2 + 17;
    const source = Array.from({ length: total }, (_, i) => ({ id: i }));
    const calls: [number, number][] = [];
    const rows = await fetchAllPages<{ id: number }>(async (from, to) => {
      calls.push([from, to]);
      return { data: source.slice(from, to + 1), error: null };
    }, "test");
    expect(rows).toHaveLength(total);
    expect(calls).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE * 2 - 1],
      [PAGE_SIZE * 2, PAGE_SIZE * 3 - 1],
    ]);
  });

  it("stops at max when given", async () => {
    const source = Array.from({ length: 2500 }, (_, i) => i);
    const rows = await fetchAllPages<number>(
      async (from, to) => ({ data: source.slice(from, to + 1), error: null }),
      "test",
      1201,
    );
    expect(rows).toHaveLength(1201);
  });

  it("throws with the prefix when a page errors", async () => {
    await expect(
      fetchAllPages(async () => ({ data: null, error: { message: "boom" } }), "Couldn't read items"),
    ).rejects.toThrow("Couldn't read items: boom");
  });
});
