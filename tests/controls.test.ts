import { describe, expect, test } from "vitest";
import {
  C5_REPEATS_PER_SECOND,
  clampControl,
  CONTROL_SPECS,
  effectiveLoopSampleCount,
} from "../app/earthscope/controls";
import { EARTHSCOPE_MAX_SAMPLES } from "../app/lib/earthScopeConfig";

describe("instrument controls", () => {
  test("keeps the loop range fixed at the full EarthScope window", () => {
    expect(CONTROL_SPECS.sampleCount.min).toBe(4);
    expect(CONTROL_SPECS.sampleCount.max).toBe(12_000);
    expect(CONTROL_SPECS.sampleCount.max).toBe(EARTHSCOPE_MAX_SAMPLES);
    expect(clampControl("sampleCount", 12_000)).toBe(12_000);
  });

  test("clamps stepped controls while keeping repeat rate continuous", () => {
    expect(clampControl("sampleCount", 20_000)).toBe(12_000);
    expect(CONTROL_SPECS.repeatsPerSecond.step).toBe("any");
    expect(clampControl("repeatsPerSecond", 2.126789)).toBe(2.126789);
    expect(C5_REPEATS_PER_SECOND).toBeCloseTo(523.2511306011972);
    expect(CONTROL_SPECS.repeatsPerSecond.max).toBe(C5_REPEATS_PER_SECOND);
    expect(clampControl("repeatsPerSecond", 100)).toBe(100);
    expect(clampControl("repeatsPerSecond", 600)).toBe(
      C5_REPEATS_PER_SECOND,
    );
    expect(clampControl("cutoff", Number.NaN)).toBe(80);
    expect(clampControl("volume", -1)).toBe(0);
    expect(clampControl("volume", 0.333)).toBe(0.33);
    expect(clampControl("volume", 2)).toBe(1);
  });

  test("reports the sample count the current stream can actually supply", () => {
    expect(effectiveLoopSampleCount(12_000, 3_200)).toBe(3_200);
    expect(effectiveLoopSampleCount(12_000, 12_000)).toBe(12_000);
    expect(effectiveLoopSampleCount(100, 0)).toBe(0);
  });
});
