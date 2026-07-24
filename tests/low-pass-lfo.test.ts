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
  lowPassLfoTempoToPosition,
  positionToLowPassLfoRate,
  positionToLowPassLfoTempo,
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
    for (const rate of [0.01, 0.05, 0.5, 2, 10, 20]) {
      expect(
        positionToLowPassLfoRate(lowPassLfoRateToPosition(rate)),
      ).toBeCloseTo(rate);
    }
  });

  test("maps the tempo dial endpoints exactly", () => {
    expect(lowPassLfoTempoToPosition(LOW_PASS_LFO_TEMPO_MIN)).toBe(0);
    expect(lowPassLfoTempoToPosition(LOW_PASS_LFO_TEMPO_MAX)).toBe(1);
    expect(positionToLowPassLfoTempo(0)).toBe(LOW_PASS_LFO_TEMPO_MIN);
    expect(positionToLowPassLfoTempo(1)).toBe(LOW_PASS_LFO_TEMPO_MAX);
  });

  test("turns musical divisions into rates at the selected tempo", () => {
    const base = {
      depth: 0.5,
      rate: 0.5,
      tempoBpm: 120,
    };
    expect(lowPassLfoRateHz({ ...base, timing: "free" })).toBe(0.5);
    expect(lowPassLfoRateHz({ ...base, timing: "quarter" })).toBe(2);
    expect(lowPassLfoRateHz({ ...base, timing: "eighth" })).toBe(4);
    expect(lowPassLfoRateHz({ ...base, timing: "eighth-triplet" })).toBe(6);
    expect(lowPassLfoRateHz({ ...base, timing: "sixteenth" })).toBe(8);
    expect(lowPassLfoRateHz({ ...base, timing: "sixteenth-triplet" })).toBe(12);
  });
});
