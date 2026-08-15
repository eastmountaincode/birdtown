import { describe, expect, test } from "vitest";
import {
  buildSequenceSchedule,
  sequenceAudioStartAt,
} from "../app/earthscope/sequenceSchedule";
import {
  DEFAULT_SEQUENCE,
  sequencePositionAtTime,
  setSequenceNote,
} from "../app/earthscope/sequencer";

describe("sequencer audio schedule", () => {
  test("schedules the programmed columns exactly across the loop boundary", () => {
    const step1 = setSequenceNote(DEFAULT_SEQUENCE, 0, 38);
    const step9 = setSequenceNote(step1, 8, 38);
    const sequence = setSequenceNote(step9, 12, 38);

    const schedule = buildSequenceSchedule({
      fallbackRate: 4,
      now: 1.75,
      sequence,
      startAt: 0,
      tempoBpm: 120,
      until: 3.7,
    });

    expect(
      schedule.events
        .filter((event) => event.at > 1.75 && event.gateOpen)
        .map((event) => event.step + 1),
    ).toEqual([1, 9, 13]);
  });

  test("uses the same transport origin as the visible playhead", () => {
    const audioNow = 2;
    const performanceNowMs = 10_500;
    const startedAtMs = 500;
    const startAt = sequenceAudioStartAt({
      audioNow,
      performanceNowMs,
      startedAtMs,
    });

    const audioPosition = sequencePositionAtTime({
      length: 16,
      now: audioNow,
      startAt,
      tempoBpm: 120,
    });
    const visiblePosition = sequencePositionAtTime({
      length: 16,
      now: performanceNowMs / 1_000,
      startAt: startedAtMs / 1_000,
      tempoBpm: 120,
    });

    expect(audioPosition).toEqual(visiblePosition);
  });
});
