import { MAX_SEQUENCE_STEPS, type MelodicSequence, type SequenceGate } from './sequencer';

export interface RecordingCursor {
  position: number;
  note: number | null;
  writtenStep: number | null;
}

// Positions are absolute sixteenth-note units, not animation-frame indices.
// A played column replaces its old take; untouched columns keep overdubs.
export function advanceSequenceRecording(
  sequence: MelodicSequence,
  cursor: RecordingCursor | null,
  position: number,
  nextNote: number | null,
): { sequence: MelodicSequence; cursor: RecordingCursor } {
  if (!cursor || position < cursor.position) {
    return { sequence, cursor: { position, note: nextNote, writtenStep: null } };
  }
  const notes = [...sequence.notes];
  const gates = Array.from({ length: MAX_SEQUENCE_STEPS }, (_, i) => sequence.gates?.[i] ?? null);
  let writtenStep = cursor.writtenStep;
  // After a suspended tab, only the latest loop can remain in the pattern.
  let from = Math.max(cursor.position, Math.floor(position) - sequence.length);
  while (from < position) {
    const absoluteStep = Math.floor(from);
    const step = absoluteStep % sequence.length;
    const end = Math.min(position, absoluteStep + 1);
    if (cursor.note !== null && writtenStep !== absoluteStep) {
      notes[step] = null;
      gates[step] = [];
      writtenStep = absoluteStep;
    }
    if (cursor.note !== null) {
      const segments: SequenceGate[] = notes[step] === cursor.note ? [...(gates[step] ?? [])] : [];
      const start = from - absoluteStep;
      const finish = end - absoluteStep;
      const last = segments.at(-1);
      if (last && Math.abs(last.end - start) < 1e-9) {
        segments[segments.length - 1] = { start: last.start, end: finish };
      } else {
        segments.push({ start, end: finish });
      }
      notes[step] = cursor.note;
      gates[step] = segments;
    }
    from = end;
  }
  return {
    sequence: position === cursor.position ? sequence : { ...sequence, notes, gates },
    cursor: { position, note: nextNote, writtenStep },
  };
}
