import { describe, expect, test } from "vitest";
import { CONTROL_SPECS } from "../app/earthscope/controls";
import {
  positionToSampleCount,
  sampleCountToPosition,
} from "../app/earthscope/sampleCountScale";

describe("sample count scale", () => {
  test("maps the complete control range to both slider endpoints", () => {
    expect(sampleCountToPosition(CONTROL_SPECS.sampleCount.min)).toBe(0);
    expect(sampleCountToPosition(CONTROL_SPECS.sampleCount.max)).toBe(1);
    expect(positionToSampleCount(0)).toBe(CONTROL_SPECS.sampleCount.min);
    expect(positionToSampleCount(1)).toBe(CONTROL_SPECS.sampleCount.max);
  });

  test.each([4, 5, 8, 9, 10, 16, 72, 100, 1_000, 12_000])(
    "round-trips %i samples",
    (sampleCount) => {
      expect(positionToSampleCount(sampleCountToPosition(sampleCount))).toBe(
        sampleCount,
      );
    },
  );

  test("round-trips every playable integer sample count", () => {
    for (
      let sampleCount = CONTROL_SPECS.sampleCount.min;
      sampleCount <= CONTROL_SPECS.sampleCount.max;
      sampleCount += 1
    ) {
      expect(positionToSampleCount(sampleCountToPosition(sampleCount))).toBe(
        sampleCount,
      );
    }
  });

  test("uses the geometric midpoint instead of the linear midpoint", () => {
    expect(positionToSampleCount(0.5)).toBe(219);
  });

  test("gives neighboring low sample counts meaningful slider travel", () => {
    const firstSampleStep =
      sampleCountToPosition(5) - sampleCountToPosition(4);
    const highSampleStep =
      sampleCountToPosition(10_001) - sampleCountToPosition(10_000);

    expect(firstSampleStep).toBeGreaterThan(0.01);
    expect(firstSampleStep).toBeGreaterThan(highSampleStep * 1_000);
  });
});
