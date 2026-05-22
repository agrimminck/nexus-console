import { describe, it, expect, beforeEach } from "vitest";
import { isAllFxOff, setAllFx, readFxState } from "./fxUtils";

describe("isAllFxOff", () => {
  it("true when all disabled", () => {
    expect(isAllFxOff(false, false, false, false)).toBe(true);
  });

  it("false when any single fx is enabled", () => {
    expect(isAllFxOff(true, false, false, false)).toBe(false);
    expect(isAllFxOff(false, true, false, false)).toBe(false);
    expect(isAllFxOff(false, false, true, false)).toBe(false);
    expect(isAllFxOff(false, false, false, true)).toBe(false);
  });

  it("false when all enabled", () => {
    expect(isAllFxOff(true, true, true, true)).toBe(false);
  });
});

describe("setAllFx + readFxState", () => {
  beforeEach(() => localStorage.clear());

  it("disables all fx", () => {
    setAllFx(false);
    const s = readFxState();
    expect(s.fx).toBe(false);
    expect(s.matrix).toBe(false);
    expect(s.cursor).toBe(false);
    expect(s.sound).toBe(false);
  });

  it("enables all fx", () => {
    setAllFx(false);
    setAllFx(true);
    const s = readFxState();
    expect(s.fx).toBe(true);
    expect(s.matrix).toBe(true);
    expect(s.cursor).toBe(true);
    expect(s.sound).toBe(true);
  });

  it("toggle off → isAllFxOff true", () => {
    setAllFx(false);
    const s = readFxState();
    expect(isAllFxOff(s.fx, s.matrix, s.cursor, s.sound)).toBe(true);
  });
});

describe("readFxState defaults", () => {
  beforeEach(() => localStorage.clear());

  it("all on when no keys set", () => {
    const s = readFxState();
    expect(s.fx).toBe(true);
    expect(s.matrix).toBe(true);
    expect(s.cursor).toBe(true);
    expect(s.sound).toBe(true);
  });
});
