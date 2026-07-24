import { describe, expect, test } from "vitest";
import {
  browserBufferRate,
  playbackRateForRepeats,
} from "../app/earthscope/audioMath";

describe("EarthScope audio rendering", () => {
  test("honors the browser audio-buffer sample-rate floor", () => {
    expect(browserBufferRate(100)).toBe(8000);
    expect(browserBufferRate(3200)).toBe(8000);
    expect(browserBufferRate(9600)).toBe(9600);
  });

  test("turns the selected loop into the requested repeats per second", () => {
    expect(playbackRateForRepeats(4, 2)).toBe(8);
    expect(playbackRateForRepeats(0.5, 4)).toBe(2);
  });
});
