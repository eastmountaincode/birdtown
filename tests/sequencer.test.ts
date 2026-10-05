import { describe, expect, test } from "vitest";
import {
  canTransposeSequence,
  clearSequence,
  DEFAULT_SEQUENCE,
  retimeTransportForSequenceLength,
  SEQUENCE_LENGTHS,
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
    expect(SEQUENCE_LENGTHS).toEqual([8, 16, 24, 32]);
    expect(DEFAULT_SEQUENCE.notes).toHaveLength(32);
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

  test("keeps step 1 at step 1 when changing from 16 to 32 steps", () => {
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
        length: 32,
        now: nowMs / 1_000,
        startAt: 0,
        tempoBpm,
      }).step,
    ).toBe(16);

    const retimed = retimeTransportForSequenceLength({
      currentLength: 16,
      nextLength: 32,
      nowMs,
      tempoBpm,
      transport,
    });
    expect(
      sequencePositionAtTime({
        length: 32,
        now: nowMs / 1_000,
        startAt: (retimed.startedAtMs ?? 0) / 1_000,
        tempoBpm,
      }).step,
    ).toBe(0);
  });

  test("clears every stored step, including hidden ones", () => {
    const programmed = toggleSequenceNote(DEFAULT_SEQUENCE, 31, 72);
    expect(clearSequence(programmed).notes.every((note) => note === null)).toBe(
      true,
    );
  });

  test("moves every stored step up or down one octave", () => {
    const withVisibleNote = setSequenceNote(DEFAULT_SEQUENCE, 0, 36);
    const withHiddenNote = setSequenceNote(withVisibleNote, 31, 47);
    const movedUp = transposeSequence(withHiddenNote, 12);
    const movedDown = transposeSequence(movedUp, -12);

    expect(movedUp.notes[0]).toBe(48);
    expect(movedUp.notes[31]).toBe(59);
    expect(movedDown.notes).toEqual(withHiddenNote.notes);
  });

    test("transposes past the former limits, including hidden steps and negative pitches", () => {
        const sequence = {
            ...setSequenceNote(setSequenceNote(DEFAULT_SEQUENCE, 0, 28), 31, 24),
            gates: [[{ start: 0.2, end: 0.8 }]],
            attacks: [true],
        };
        let lower = sequence;
        for (let octave = 0; octave < 4; octave++) {
            expect(canTransposeSequence(lower, -12)).toBe(true);
            lower = transposeSequence(lower, -12) as typeof sequence;
        }
        expect(lower.notes[0]).toBe(-20);
        expect(lower.notes[31]).toBe(-24);
        expect(lower.gates).toBe(sequence.gates);
        expect(lower.attacks).toBe(sequence.attacks);
        expect(transposeSequence(lower, 48).notes).toEqual(sequence.notes);
        const higher = transposeSequence(setSequenceNote(DEFAULT_SEQUENCE, 0, 72), 24);
        expect(higher.notes[0]).toBe(96);
        expect(sequenceRateAtStep(lower, 0, 4)).toBeCloseTo(sequencerRepeatRate(28) / 16);
        expect(sequenceRateAtStep(higher, 0, 4)).toBeCloseTo(sequencerRepeatRate(72) * 4);
    });

    test("rejects invalid pitches and transpositions without changing the pattern", () => {
        const sequence = setSequenceNote(DEFAULT_SEQUENCE, 0, 24);
        expect(canTransposeSequence(DEFAULT_SEQUENCE, 12)).toBe(false);
        for (const invalid of [NaN, Infinity, -Infinity, 0.5, 1e9, -1e9]) {
            expect(setSequenceNote(sequence, 0, invalid)).toBe(sequence);
            expect(transposeSequence(sequence, invalid)).toBe(sequence);
            expect(sequencerNotesForOctave(invalid)).toEqual([]);
        }
    });

    test("renders and edits full octaves outside the former range", () => {
        for (const octave of [-2, -1, 0, 2, 5, 6]) {
            const notes = sequencerNotesForOctave(octave);
            expect(notes).toHaveLength(12);
            expect(notes[0]).toBe((octave + 1) * 12 + 11);
            expect(notes[11]).toBe((octave + 1) * 12);
            expect(setSequenceNote(DEFAULT_SEQUENCE, 0, notes[11]).notes[0]).toBe(notes[11]);
        }
        expect(sequencerNoteName(-12)).toBe("C-2");
        expect(sequencerNoteName(-1)).toBe("B-2");
        expect(sequencerNoteName(12)).toBe("C0");
        expect(sequencerNoteName(36)).toBe("C2");
        expect(sequencerNoteName(46)).toBe("A#2");
        expect(sequencerNoteName(72)).toBe("C5");
    });

    test("maps pitches above and below the former range to their frequencies", () => {
        expect(sequencerRepeatRate(12)).toBeCloseTo(16.3515978);
        expect(sequencerRepeatRate(24)).toBeCloseTo(32.7031957);
        expect(sequencerRepeatRate(60)).toBeCloseTo(261.6255653);
        expect(sequencerRepeatRate(72)).toBeCloseTo(523.2511306);
        expect(sequencerRepeatRate(84)).toBeCloseTo(1046.5022612);
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
