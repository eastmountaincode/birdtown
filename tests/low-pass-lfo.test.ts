import { describe, expect, test } from "vitest";
import {
  clampLowPassLfo,
  LOW_PASS_LFO_RATE_MAX,
  LOW_PASS_LFO_RATE_MIN,
  LOW_PASS_LFO_TEMPO_MAX,
  LOW_PASS_LFO_TEMPO_MIN,
  lowPassLfoDepthHz,
  lowPassLfoRateHz,
  lowPassLfoRateToPosition,
  lowPassLfoTimeToPosition,
  lowPassLfoTimingToPosition,
  positionToLowPassLfoRate,
  positionToLowPassLfoTimeRate,
  positionToLowPassLfoTiming,
} from "../app/earthscope/lowPassLfo";

describe("low-pass LFO", () => {
  test("clamps depth and rate to their playable ranges", () => {
    expect(clampLowPassLfo("depth", -1)).toBe(0);
    expect(clampLowPassLfo("depth", 1.5)).toBe(1);
    expect(clampLowPassLfo("rate", 0)).toBe(LOW_PASS_LFO_RATE_MIN);
    expect(clampLowPassLfo("rate", 30)).toBe(LOW_PASS_LFO_RATE_MAX);
    expect(clampLowPassLfo("tempoBpm", 10)).toBe(LOW_PASS_LFO_TEMPO_MIN);
    expect(clampLowPassLfo("tempoBpm", 400)).toBe(LOW_PASS_LFO_TEMPO_MAX);
  });

  test("keeps the cutoff movement equally above and below its center", () => {
    expect(lowPassLfoDepthHz(420, 0)).toBe(0);
    expect(lowPassLfoDepthHz(420, 0.5)).toBe(200);
    expect(lowPassLfoDepthHz(420, 1)).toBe(400);
    expect(lowPassLfoDepthHz(80, 1)).toBe(60);
    expect(lowPassLfoDepthHz(2400, 1)).toBe(2380);
  });

  test("maps the rate endpoints exactly", () => {
    expect(lowPassLfoRateToPosition(LOW_PASS_LFO_RATE_MIN)).toBe(0);
    expect(lowPassLfoRateToPosition(LOW_PASS_LFO_RATE_MAX)).toBe(1);
    expect(positionToLowPassLfoRate(0)).toBe(LOW_PASS_LFO_RATE_MIN);
    expect(positionToLowPassLfoRate(1)).toBeCloseTo(LOW_PASS_LFO_RATE_MAX);
  });

  test("round-trips useful slow and fast rates", () => {
    for (const rate of [0.1, 0.25, 0.5, 2, 10, 20]) {
      expect(
        positionToLowPassLfoRate(lowPassLfoRateToPosition(rate)),
      ).toBeCloseTo(rate);
    }
  });

  test("maps the free-time dial from fast to slow", () => {
    expect(lowPassLfoTimeToPosition(LOW_PASS_LFO_RATE_MAX)).toBe(0);
    expect(lowPassLfoTimeToPosition(LOW_PASS_LFO_RATE_MIN)).toBe(1);
    expect(positionToLowPassLfoTimeRate(0)).toBeCloseTo(
      LOW_PASS_LFO_RATE_MAX,
    );
    expect(positionToLowPassLfoTimeRate(1)).toBeCloseTo(
      LOW_PASS_LFO_RATE_MIN,
    );
    expect(1 / positionToLowPassLfoTimeRate(1)).toBe(10);
  });

  test("maps the division dial across every musical timing", () => {
    expect(positionToLowPassLfoTiming(0).value).toBe("whole");
    expect(positionToLowPassLfoTiming(1).value).toBe("thirty-second");
    expect(lowPassLfoTimingToPosition("whole")).toBe(0);
    expect(lowPassLfoTimingToPosition("thirty-second")).toBe(1);
  });

  test("turns musical divisions into rates at the selected tempo", () => {
    const base = {
      depth: 0.5,
      rate: 0.5,
      syncEnabled: true,
      tempoBpm: 120,
    };
    expect(
      lowPassLfoRateHz({
        ...base,
        syncEnabled: false,
        timing: "eighth",
      }),
    ).toBe(0.5);
    expect(lowPassLfoRateHz({ ...base, timing: "quarter" })).toBe(2);
    expect(lowPassLfoRateHz({ ...base, timing: "eighth" })).toBe(4);
    expect(lowPassLfoRateHz({ ...base, timing: "eighth-triplet" })).toBe(6);
    expect(lowPassLfoRateHz({ ...base, timing: "sixteenth" })).toBe(8);
    expect(lowPassLfoRateHz({ ...base, timing: "sixteenth-triplet" })).toBe(12);
  });
});
