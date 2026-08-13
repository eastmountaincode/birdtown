import { clampTempo } from "./tempo";

export const SEQUENCE_LENGTHS = [8, 16, 24, 36] as const;
export const MAX_SEQUENCE_STEPS = 36;
export const SEQUENCER_OCTAVES = [1, 2, 3, 4, 5] as const;
export const SEQUENCER_MIN_NOTE = 24;
export const SEQUENCER_MAX_NOTE = 72;

export type SequenceLength = (typeof SEQUENCE_LENGTHS)[number];
export type SequencerOctave = (typeof SEQUENCER_OCTAVES)[number];

export interface MelodicSequence {
  enabled: boolean;
  length: SequenceLength;
  notes: readonly (number | null)[];
}

export interface SequencerTransport {
  running: boolean;
  startedAtMs: number | null;
}

export interface SequencePosition {
  progress: number;
  step: number;
}

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const DEFAULT_SEQUENCE: MelodicSequence = {
  enabled: true,
  length: 16,
  notes: Array<number | null>(MAX_SEQUENCE_STEPS).fill(null),
};

export const STOPPED_SEQUENCER_TRANSPORT: SequencerTransport = {
  running: false,
  startedAtMs: null,
};

export function isSequenceLength(value: number): value is SequenceLength {
  return SEQUENCE_LENGTHS.some((length) => length === value);
}

export function sequenceHasNotes(sequence: MelodicSequence) {
  return sequence.notes
    .slice(0, sequence.length)
    .some((note) => note !== null);
}

export function isSequencerNote(note: number) {
  return (
    Number.isInteger(note) &&
    note >= SEQUENCER_MIN_NOTE &&
    note <= SEQUENCER_MAX_NOTE
  );
}

export function setSequenceEnabled(
  sequence: MelodicSequence,
  enabled: boolean,
): MelodicSequence {
  return sequence.enabled === enabled ? sequence : { ...sequence, enabled };
}

export function setSequenceLength(
  sequence: MelodicSequence,
  length: SequenceLength,
): MelodicSequence {
  return { ...sequence, length };
}

export function toggleSequenceNote(
  sequence: MelodicSequence,
  step: number,
  note: number,
): MelodicSequence {
  return setSequenceNote(
    sequence,
    step,
    sequence.notes[step] === note ? null : note,
  );
}

export function setSequenceNote(
  sequence: MelodicSequence,
  step: number,
  note: number | null,
): MelodicSequence {
  if (
    !Number.isInteger(step) ||
    step < 0 ||
    step >= MAX_SEQUENCE_STEPS ||
    (note !== null && !isSequencerNote(note))
  ) {
    return sequence;
  }

  if ((sequence.notes[step] ?? null) === note) return sequence;

  const notes = Array.from(
    { length: MAX_SEQUENCE_STEPS },
    (_, index) => sequence.notes[index] ?? null,
  );
  notes[step] = note;
  return { ...sequence, notes };
}

export function clearSequence(sequence: MelodicSequence): MelodicSequence {
  if (!sequence.notes.some((note) => note !== null)) return sequence;
  return {
    ...sequence,
    notes: Array<number | null>(MAX_SEQUENCE_STEPS).fill(null),
  };
}

export function sequencerNotesForOctave(octave: SequencerOctave) {
  const firstNote = (octave + 1) * 12;
  const lastNote = Math.min(firstNote + 11, SEQUENCER_MAX_NOTE);
  return Array.from(
    { length: lastNote - firstNote + 1 },
    (_, index) => lastNote - index,
  );
}

export function sequencerNoteName(note: number) {
  const rounded = Math.round(note);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

export function sequencerRepeatRate(note: number) {
  const finiteNote = Number.isFinite(note) ? note : SEQUENCER_MIN_NOTE;
  return 440 * Math.pow(2, (finiteNote - 69) / 12);
}

export function sequenceStepDurationSeconds(tempoBpm: number) {
  return 60 / clampTempo(tempoBpm) / 4;
}

export function sequencePositionAtTime({
  length,
  now,
  startAt,
  tempoBpm,
}: {
  length: number;
  now: number;
  startAt: number;
  tempoBpm: number;
}): SequencePosition {
  const safeLength = Math.max(1, Math.floor(length));
  const duration = sequenceStepDurationSeconds(tempoBpm);
  const elapsedSteps = Math.max(0, now - startAt) / duration;
  const wholeStep = Math.floor(elapsedSteps);
  return {
    progress: elapsedSteps - wholeStep,
    step: wholeStep % safeLength,
  };
}

export function sequenceRateAtStep(
  sequence: MelodicSequence,
  step: number,
  fallbackRate: number,
) {
  const safeLength = Math.max(1, sequence.length);
  const normalizedStep =
    ((Math.floor(step) % safeLength) + safeLength) % safeLength;

  for (let distance = 0; distance < safeLength; distance += 1) {
    const index = (normalizedStep - distance + safeLength) % safeLength;
    const note = sequence.notes[index];
    if (note !== null && note !== undefined) {
      return sequencerRepeatRate(note);
    }
  }

  return fallbackRate;
}
