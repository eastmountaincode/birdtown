import { describe, expect, test } from "vitest";
import {
  clearSequence,
  DEFAULT_SEQUENCE,
  sequenceHasNotes,
  sequencePositionAtTime,
  sequenceRateAtStep,
  sequenceStepDurationSeconds,
  sequencerNoteName,
  sequencerNotesForOctave,
  sequencerRepeatRate,
  setSequenceLength,
  toggleSequenceNote,
} from "../app/earthscope/sequencer";

describe("melodic sequencer", () => {
  test("starts as an empty 16-step sequence", () => {
    expect(DEFAULT_SEQUENCE.length).toBe(16);
    expect(DEFAULT_SEQUENCE.notes).toHaveLength(36);
    expect(sequenceHasNotes(DEFAULT_SEQUENCE)).toBe(false);
  });

  test("keeps one note or rest in each step", () => {
    const c2 = toggleSequenceNote(DEFAULT_SEQUENCE, 0, 36);
    const e2 = toggleSequenceNote(c2, 0, 40);
    const rest = toggleSequenceNote(e2, 0, 40);

    expect(c2.notes[0]).toBe(36);
    expect(e2.notes[0]).toBe(40);
    expect(rest.notes[0]).toBeNull();
  });

  test("preserves hidden steps when the visible length changes", () => {
    const programmed = toggleSequenceNote(DEFAULT_SEQUENCE, 23, 48);
    const shortened = setSequenceLength(programmed, 8);
    const expanded = setSequenceLength(shortened, 24);

    expect(sequenceHasNotes(shortened)).toBe(false);
    expect(expanded.notes[23]).toBe(48);
    expect(sequenceHasNotes(expanded)).toBe(true);
  });

  test("clears every stored step, including hidden ones", () => {
    const programmed = toggleSequenceNote(DEFAULT_SEQUENCE, 35, 72);
    expect(clearSequence(programmed).notes.every((note) => note === null)).toBe(
      true,
    );
  });

  test("renders complete chromatic octaves through the C5 ceiling", () => {
    expect(sequencerNotesForOctave(2)).toEqual([
      47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36,
    ]);
    expect(sequencerNotesForOctave(5)).toEqual([72]);
    expect(sequencerNoteName(36)).toBe("C2");
    expect(sequencerNoteName(46)).toBe("A#2");
    expect(sequencerNoteName(72)).toBe("C5");
  });

  test("maps pitch rows to the established C1 through C5 frequency range", () => {
    expect(sequencerRepeatRate(24)).toBeCloseTo(32.7031957);
    expect(sequencerRepeatRate(60)).toBeCloseTo(261.6255653);
    expect(sequencerRepeatRate(72)).toBeCloseTo(523.2511306);
  });

  test("runs each column as a sixteenth note at the shared tempo", () => {
    expect(sequenceStepDurationSeconds(120)).toBe(0.125);
    expect(
      sequencePositionAtTime({
        length: 8,
        now: 0.375,
        startAt: 0,
        tempoBpm: 120,
      }),
    ).toEqual({ progress: 0, step: 3 });
    expect(
      sequencePositionAtTime({
        length: 8,
        now: 1.125,
        startAt: 0,
        tempoBpm: 120,
      }).step,
    ).toBe(1);
  });

  test("rests retain the previous pitch while closing the sequencer gate", () => {
    const withC2 = toggleSequenceNote(DEFAULT_SEQUENCE, 0, 36);
    const withG2 = toggleSequenceNote(withC2, 4, 43);

    expect(sequenceRateAtStep(withG2, 1, 4)).toBeCloseTo(
      sequencerRepeatRate(36),
    );
    expect(sequenceRateAtStep(withG2, 5, 4)).toBeCloseTo(
      sequencerRepeatRate(43),
    );
  });
});
