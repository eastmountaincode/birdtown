import { MAX_SEQUENCE_STEPS, type MelodicSequence } from './sequencer';

interface NoteSpan { start: number; end: number; note: number }

export function quantizeSequence(sequence: MelodicSequence): MelodicSequence {
  const spans: NoteSpan[] = [];
  const length = sequence.length;
  for (let step = 0; step < length; step++) {
    const note = sequence.notes[step];
    if (note === null || note === undefined) continue;
    for (const gate of sequence.gates?.[step] ?? [{ start: 0, end: 1 }]) {
      if (gate.end <= gate.start) continue;
      const start = step + gate.start;
      const end = step + gate.end;
      const previous = spans.at(-1);
      const newAttack = gate.start === 0 && sequence.attacks?.[step];
      if (previous && previous.note === note && Math.abs(previous.end - start) < 1e-9 && !newAttack) {
        previous.end = end;
      } else {
        spans.push({ start, end, note });
      }
    }
  }
  if (!spans.length) return sequence;
  // A held note crossing the loop edge is one note, not two separate hits.
  const first = spans[0], last = spans.at(-1)!;
  if (spans.length > 1 && first.start === 0 && last.end === length && first.note === last.note && !sequence.attacks?.[0]) {
    last.end += first.end;
    spans.shift();
  }
  const continuousLoop = spans.length === 1 && spans[0].start === 0 && spans[0].end === length && !sequence.attacks?.[0];
  const notes = Array.from({ length: MAX_SEQUENCE_STEPS }, (_, i) => i < length ? null : sequence.notes[i] ?? null);
  const gates = Array.from({ length: MAX_SEQUENCE_STEPS }, (_, i) => i < length ? null : sequence.gates?.[i] ?? null);
  const attacks = Array.from({ length: MAX_SEQUENCE_STEPS }, (_, i) => i < length ? false : sequence.attacks?.[i] ?? false);
  for (const span of spans) {
    const start = Math.round(span.start);
    const end = Math.min(start + length, Math.max(start + 1, Math.ceil(span.end - 1e-9)));
    // The instrument remains monophonic. If hits quantize onto the same
    // column, the later hit replaces the earlier one at that resolution.
    for (let position = start; position < end; position++) {
      const step = position % length;
      notes[step] = span.note;
      attacks[step] = position === start && !continuousLoop;
    }
  }
  return { ...sequence, notes, gates, attacks };
}
