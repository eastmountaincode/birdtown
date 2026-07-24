import { describe, expect, test } from "vitest";
import {
  centerAndScale,
  prepareLoop,
  recent,
} from "../app/earthscope/signal";

describe("EarthScope signal analysis", () => {
  test("selects the requested recent signal window", () => {
    expect(recent([1, 2, 3, 4, 5], 2, 1)).toEqual([4, 5]);
    expect(recent([1, 2, 3], 0)).toEqual([2, 3]);
  });

  test("centers and peak-normalizes a waveform", () => {
    const output = centerAndScale([10, 20, 30]);
    expect(Array.from(output)).toEqual([-1, 0, 1]);
  });

  test("removes the artificial discontinuity at a loop boundary", () => {
    const output = prepareLoop([2, 8, -3, 5]);
    expect(output[0]).toBeCloseTo(0, 10);
    expect(output.at(-1)).toBeCloseTo(0, 10);
    expect(Math.max(...Array.from(output).map(Math.abs))).toBeCloseTo(1, 10);
  });

});
