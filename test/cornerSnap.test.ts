import { afterEach, describe, expect, it } from "vitest";

import { clampPositionToViewport, getViewportSize } from "../src/internal/cornerSnap";

describe("cornerSnap", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  afterEach(() => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  it("returns an empty viewport without DOM globals", () => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    expect(getViewportSize()).toEqual({
      width: 0,
      height: 0,
    });
  });

  it("clamps a wide widget inside the right viewport edge", () => {
    expect(
      clampPositionToViewport(
        { x: 900, y: 16 },
        { width: 1000, height: 700 },
        { width: 240, height: 72 },
        16,
      ),
    ).toEqual({
      x: 744,
      y: 16,
    });
  });

  it("clamps a tall widget inside the bottom viewport edge", () => {
    expect(
      clampPositionToViewport(
        { x: 16, y: 900 },
        { width: 1000, height: 700 },
        { width: 96, height: 320 },
        16,
      ),
    ).toEqual({
      x: 16,
      y: 364,
    });
  });
});
