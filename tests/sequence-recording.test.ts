import { describe, expect, test } from 'vitest';
import { advanceSequenceRecording, type RecordingCursor } from '../app/earthscope/sequenceRecording';
import { buildSequenceSchedule } from '../app/earthscope/sequenceSchedule';
import { DEFAULT_SEQUENCE, clearSequence, setSequenceNote, transposeSequence, type MelodicSequence } from '../app/earthscope/sequencer';

function record(events: [number, number | null][], initial = DEFAULT_SEQUENCE) {
  let state: { sequence: MelodicSequence; cursor: RecordingCursor | null } = { sequence: initial, cursor: null };
  for (const [position, note] of events) state = advanceSequenceRecording(state.sequence, state.cursor, position, note);
  return state.sequence;
}
const schedule = (sequence: MelodicSequence, now = 0, until = 1) => buildSequenceSchedule({
  sequence, now, until, startAt: 0, tempoBpm: 120, fallbackRate: 4,
}).events;

describe('recorded note articulation', () => {
  test('keeps short rests between repeated notes in adjacent columns', () => {
    const sequence = record([[0, 33], [.7, null], [1, 33], [1.65, null], [2, null]]);
    expect(sequence.notes.slice(0, 3)).toEqual([33, 33, null]);
    expect(sequence.gates?.[0]).toEqual([{ start: 0, end: .7 }]);
    expect(sequence.gates?.[1]?.[0].end).toBeCloseTo(.65);
    expect(schedule(sequence).filter(e => e.at < .25).map(e => [e.at, e.gateOpen])).toEqual([
      [0, true], [.0875, false], [.125, true], [.20625, false],
    ]);
  });

  test('retains two hits and their gap even within one sixteenth', () => {
    const sequence = record([[.1, 31], [.35, null], [.55, 31], [.9, null]]);
    expect(sequence.gates?.[0]).toEqual([{ start: .1, end: .35 }, { start: .55, end: .9 }]);
    const changes = schedule(sequence).filter(e => e.at < .125);
    expect(changes.map(e => e.gateOpen)).toEqual([false, true, false, true, false]);
    expect(changes.map(e => e.at)).toEqual([0, .0125, .04375, .06875, .1125]);
  });

  test('fills missed visual frames without breaking a sustained note', () => {
    const sequence = record([[.2, 31], [3.7, null]]);
    expect(sequence.notes.slice(0, 4)).toEqual([31, 31, 31, 31]);
    expect(sequence.gates?.[1]).toEqual([{ start: 0, end: 1 }]);
    expect(schedule(sequence).filter(e => e.at > .025 && e.at < .4625).every(e => e.gateOpen)).toBe(true);
  });

  test('records releases and onsets accurately across the loop boundary', () => {
    const sequence = record([[15.5, 33], [16.2, null], [16.6, 33], [16.9, null]]);
    expect(sequence.gates?.[15]).toEqual([{ start: .5, end: 1 }]);
    expect(sequence.gates?.[0]).toHaveLength(2);
    const events = schedule(sequence, 1.9, 2.13);
    expect(events.some(e => !e.gateOpen && Math.abs(e.at - 2.025) < 1e-9)).toBe(true);
    expect(events.some(e => e.gateOpen && Math.abs(e.at - 2.075) < 1e-9)).toBe(true);
  });

  test('a schedule refill inside a rest stays silent and retains later onsets', () => {
    const sequence = record([[0, 33], [.2, null], [.7, 33], [.9, null]]);
    expect(schedule(sequence, .05, .1).map(e => [e.at, e.gateOpen])).toEqual([[.05, false], [.0875, true]]);
    expect(schedule(sequence, .1, .13).map(e => [e.at, e.gateOpen])).toEqual([[.1, true], [.1125, false], [.125, false]]);
  });

  test('overdub and manual edits stay monophonic; transpose keeps timing; clear removes it', () => {
    const initial = setSequenceNote(DEFAULT_SEQUENCE, 4, 40);
    const sequence = record([[0, 31], [.4, null], [.6, 33], [.9, null], [5, null]], initial);
    expect(sequence.notes[0]).toBe(33);
    expect(sequence.gates?.[0]).toEqual([{ start: .6, end: .9 }]);
    expect(sequence.notes[4]).toBe(40);
    expect(transposeSequence(sequence, 12).gates).toEqual(sequence.gates);
    expect(setSequenceNote(sequence, 0, 35).gates?.[0]).toBeNull();
    expect(clearSequence(sequence).gates).toBeUndefined();
  });
});
