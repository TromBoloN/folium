import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ClientData,
  getClientDataSnapshot,
  getServerClientDataSnapshot,
  setClientData,
  subscribeClientData,
} from "./client-data-store";

const DATA: ClientData = {
  courses: [{ id: "c1", name: "Calculus I", code: "MAT101", color: "#1c7ed6", archived: false }],
  timeZone: "Asia/Makassar",
  weekStart: "monday",
  timeFormat: "24h",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client data store", () => {
  // Vitest runs in Node: no `window`, like server rendering.
  it("never holds data on the server", () => {
    expect(typeof window).toBe("undefined");
    const listener = vi.fn();
    const unsubscribe = subscribeClientData(listener);
    setClientData(DATA);
    expect(getClientDataSnapshot()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("the server snapshot is always empty, even once the browser has data", () => {
    expect(getServerClientDataSnapshot()).toBeNull();
    vi.stubGlobal("window", {});
    setClientData(DATA);
    expect(getClientDataSnapshot()).toEqual(DATA);
    expect(getServerClientDataSnapshot()).toBeNull();
  });

  it("in the browser, notifies subscribers once per real change", () => {
    vi.stubGlobal("window", {});
    const listener = vi.fn();
    const unsubscribe = subscribeClientData(listener);
    const next = { ...DATA, timeFormat: "12h" as const };
    setClientData(next);
    setClientData({ ...next }); // same content: no notification
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getClientDataSnapshot()).toEqual(next);
    unsubscribe();
    setClientData(DATA);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("data set in the browser is invisible to a server-side read", () => {
    vi.stubGlobal("window", {});
    setClientData(DATA);
    vi.unstubAllGlobals();
    expect(getClientDataSnapshot()).toBeNull();
  });
});
