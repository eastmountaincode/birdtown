import { describe, expect, test } from "vitest";
import {
  positionToRepeatRate,
  repeatRateToPosition,
} from "../app/earthscope/repeatRateScale";
import {
  C5_REPEATS_PER_SECOND,
  CONTROL_SPECS,
} from "../app/earthscope/controls";

describe("repeat-rate slider scale", () => {
  test("maps the control endpoints exactly", () => {
    const { min, max } = CONTROL_SPECS.repeatsPerSecond;
    expect(repeatRateToPosition(min)).toBe(0);
    expect(repeatRateToPosition(max)).toBe(1);
    expect(positionToRepeatRate(0)).toBe(min);
    expect(positionToRepeatRate(1)).toBeCloseTo(max);
  });

  test("gives slow real-time rates visible space", () => {
    expect(repeatRateToPosition(0.0625)).toBeCloseTo(0.169);
    expect(repeatRateToPosition(1)).toBeCloseTo(0.424);
    expect(repeatRateToPosition(12.5)).toBeCloseTo(0.656);
  });

  test("round-trips representative rates", () => {
    for (const rate of [
      0.01,
      0.0625,
      0.1,
      1,
      4,
      12.5,
      40,
      80,
      130.8127827,
      261.6255653,
      C5_REPEATS_PER_SECOND,
    ]) {
      expect(positionToRepeatRate(repeatRateToPosition(rate))).toBeCloseTo(
        rate,
      );
    }
  });
});
