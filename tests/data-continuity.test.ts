import { describe, expect, test } from "vitest";
import { mergeTimedSamples } from "../app/lib/dataContinuity";

describe("EarthScope packet continuity", () => {
  test("trims overlap and resets across a timestamp gap", () => {
    const overlap = mergeTimedSamples({
      endMillis: 50,
      existing: [1, 2, 3],
      incoming: [3, 4, 5],
      lastEndMillis: 20,
      lastSampleRate: 100,
      maxSamples: 10,
      sampleRate: 100,
      startMillis: 20,
    });
    expect(overlap.samples).toEqual([1, 2, 3, 4, 5]);

    const duplicate = mergeTimedSamples({
      endMillis: 50,
      existing: overlap.samples,
      incoming: [4, 5],
      lastEndMillis: overlap.lastEndMillis,
      lastSampleRate: 100,
      maxSamples: 10,
      sampleRate: 100,
      startMillis: 40,
    });
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.samples).toEqual(overlap.samples);

    const gap = mergeTimedSamples({
      endMillis: 110,
      existing: overlap.samples,
      incoming: [8, 9],
      lastEndMillis: overlap.lastEndMillis,
      lastSampleRate: 100,
      maxSamples: 10,
      sampleRate: 100,
      startMillis: 100,
    });
    expect(gap.samples).toEqual([8, 9]);

    const rateChange = mergeTimedSamples({
      endMillis: 90,
      existing: overlap.samples,
      incoming: [6, 7, 8],
      lastEndMillis: overlap.lastEndMillis,
      lastSampleRate: 100,
      maxSamples: 10,
      sampleRate: 50,
      startMillis: 50,
    });
    expect(rateChange.samples).toEqual([6, 7, 8]);
  });
});
