import { describe, expect, test } from "vitest";
import {
  canTransposeSequence,
  clearSequence,
  DEFAULT_SEQUENCE,
  retimeTransportForSequenceLength,
  setSequenceEnabled,
  sequenceHasNotes,
  sequencePositionAtTime,
  sequenceRateAtStep,
  sequenceStepDurationSeconds,
  sequencerNoteName,
  sequencerNotesForOctave,
  sequencerRepeatRate,
  setSequenceLength,
  setSequenceNote,
  toggleSequenceNote,
  transposeSequence,
} from "../app/earthscope/sequencer";

describe("melodic sequencer", () => {
  test("starts as an empty 16-step sequence", () => {
    expect(DEFAULT_SEQUENCE.enabled).toBe(true);
    expect(DEFAULT_SEQUENCE.length).toBe(16);
    expect(DEFAULT_SEQUENCE.notes).toHaveLength(36);
    expect(sequenceHasNotes(DEFAULT_SEQUENCE)).toBe(false);
  });

  test("turns playback on and off without clearing the pattern", () => {
    const programmed = setSequenceNote(DEFAULT_SEQUENCE, 3, 36);
    const disabled = setSequenceEnabled(programmed, false);

    expect(disabled.enabled).toBe(false);
    expect(disabled.notes[3]).toBe(36);
    expect(setSequenceEnabled(disabled, true).enabled).toBe(true);
  });

  test("draws or erases a specific cell without toggling", () => {
    const drawn = setSequenceNote(DEFAULT_SEQUENCE, 2, 40);
    const same = setSequenceNote(drawn, 2, 40);
    const erased = setSequenceNote(drawn, 2, null);

    expect(drawn.notes[2]).toBe(40);
    expect(same).toBe(drawn);
    expect(erased.notes[2]).toBeNull();
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

  test("keeps step 1 at step 1 when changing from 16 to 36 steps", () => {
    const tempoBpm = 120;
    const stepDurationMs = sequenceStepDurationSeconds(tempoBpm) * 1_000;
    const nowMs = 48 * stepDurationMs;
    const transport = { running: true, startedAtMs: 0 };

    expect(
      sequencePositionAtTime({
        length: 16,
        now: nowMs / 1_000,
        startAt: 0,
        tempoBpm,
      }).step,
    ).toBe(0);
    expect(
      sequencePositionAtTime({
        length: 36,
        now: nowMs / 1_000,
        startAt: 0,
        tempoBpm,
      }).step,
    ).toBe(12);

    const retimed = retimeTransportForSequenceLength({
      currentLength: 16,
      nextLength: 36,
      nowMs,
      tempoBpm,
      transport,
    });
    expect(
      sequencePositionAtTime({
        length: 36,
        now: nowMs / 1_000,
        startAt: (retimed.startedAtMs ?? 0) / 1_000,
        tempoBpm,
      }).step,
    ).toBe(0);
  });

  test("clears every stored step, including hidden ones", () => {
    const programmed = toggleSequenceNote(DEFAULT_SEQUENCE, 35, 72);
    expect(clearSequence(programmed).notes.every((note) => note === null)).toBe(
      true,
    );
  });

  test("moves every stored step up or down one octave", () => {
    const withVisibleNote = setSequenceNote(DEFAULT_SEQUENCE, 0, 36);
    const withHiddenNote = setSequenceNote(withVisibleNote, 35, 47);
    const movedUp = transposeSequence(withHiddenNote, 12);
    const movedDown = transposeSequence(movedUp, -12);

    expect(movedUp.notes[0]).toBe(48);
    expect(movedUp.notes[35]).toBe(59);
    expect(movedDown.notes).toEqual(withHiddenNote.notes);
  });

  test("keeps the whole pattern unchanged at the pitch limits", () => {
    const atCeiling = setSequenceNote(DEFAULT_SEQUENCE, 0, 72);
    const atFloor = setSequenceNote(DEFAULT_SEQUENCE, 0, 24);

    expect(canTransposeSequence(DEFAULT_SEQUENCE, 12)).toBe(false);
    expect(canTransposeSequence(atCeiling, 12)).toBe(false);
    expect(transposeSequence(atCeiling, 12)).toBe(atCeiling);
    expect(canTransposeSequence(atFloor, -12)).toBe(false);
    expect(transposeSequence(atFloor, -12)).toBe(atFloor);
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
