import { clampTempo } from "./tempo";

export const SEQUENCE_LENGTHS = [8, 16, 24, 32] as const;
export const MAX_SEQUENCE_STEPS = 32;

export type SequenceLength = (typeof SEQUENCE_LENGTHS)[number];

export interface SequenceGate {
  start: number;
  end: number;
}

export interface MelodicSequence {
  enabled: boolean;
  length: SequenceLength;
  notes: readonly (number | null)[];
  // Missing timing means a hand-painted, full-step note.
  gates?: readonly (readonly SequenceGate[] | null)[];
  // Explicit attacks distinguish adjacent quantized hits from a held note.
  attacks?: readonly boolean[];
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
    // AudioParams use float32 values; reject only unrepresentable pitches.
    const rate = Math.fround(sequencerRepeatRate(note));
    return Number.isSafeInteger(note) && Number.isFinite(rate) && rate > 0;
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

export function retimeTransportForSequenceLength({
  currentLength,
  nextLength,
  nowMs,
  tempoBpm,
  transport,
}: {
  currentLength: SequenceLength;
  nextLength: SequenceLength;
  nowMs: number;
  tempoBpm: number;
  transport: SequencerTransport;
}): SequencerTransport {
  const startedAtMs = transport.startedAtMs;
  if (
    !transport.running ||
    startedAtMs === null ||
    currentLength === nextLength ||
    nowMs <= startedAtMs
  ) {
    return transport;
  }

  const position = sequencePositionAtTime({
    length: currentLength,
    now: nowMs / 1_000,
    startAt: startedAtMs / 1_000,
    tempoBpm,
  });
  const nextPosition = (position.step % nextLength) + position.progress;
  return {
    ...transport,
    startedAtMs:
      nowMs - nextPosition * sequenceStepDurationSeconds(tempoBpm) * 1_000,
  };
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
  const gates = sequence.gates ? [...sequence.gates] : undefined;
  if (gates) gates[step] = null;
  const attacks = sequence.attacks ? [...sequence.attacks] : undefined;
  if (attacks) attacks[step] = false;
  return { ...sequence, notes, ...(gates ? { gates } : {}), ...(attacks ? { attacks } : {}) };
}

export function clearSequence(sequence: MelodicSequence): MelodicSequence {
  if (!sequence.notes.some((note) => note !== null)) return sequence;
  return {
    ...sequence,
    notes: Array<number | null>(MAX_SEQUENCE_STEPS).fill(null),
    gates: undefined,
    attacks: undefined,
  };
}

export function canTransposeSequence(
  sequence: MelodicSequence,
  semitones: number,
) {
  const notes = sequence.notes.filter((note) => note !== null);
  return (
    notes.length > 0 &&
    Number.isInteger(semitones) &&
    notes.every((note) => isSequencerNote(note + semitones))
  );
}

export function transposeSequence(
  sequence: MelodicSequence,
  semitones: number,
): MelodicSequence {
  if (!canTransposeSequence(sequence, semitones)) return sequence;
  return {
    ...sequence,
    notes: sequence.notes.map((note) =>
      note === null ? null : note + semitones,
    ),
  };
}

export function sequencerNotesForOctave(octave: number) {
    const firstNote = (octave + 1) * 12;
    const lastNote = firstNote + 11;
    if (!Number.isSafeInteger(octave) || !isSequencerNote(firstNote) || !isSequencerNote(lastNote)) {
        return [];
    }
    return Array.from({ length: 12 }, (_, index) => lastNote - index);
}

export function sequencerNoteName(note: number) {
  const rounded = Math.round(note);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

export function sequencerRepeatRate(note: number) {
  const finiteNote = Number.isFinite(note) ? note : 24;
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
