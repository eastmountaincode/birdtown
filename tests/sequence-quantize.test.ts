import { describe, expect, test } from 'vitest';
import { quantizeSequence } from '../app/earthscope/sequenceQuantize';
import { advanceSequenceRecording } from '../app/earthscope/sequenceRecording';
import { buildSequenceSchedule } from '../app/earthscope/sequenceSchedule';
import { DEFAULT_SEQUENCE, setSequenceLength, setSequenceNote, type MelodicSequence } from '../app/earthscope/sequencer';

const recorded = (start: number, end: number, note = 35) => {
  const take = advanceSequenceRecording(DEFAULT_SEQUENCE, null, start, note);
  return advanceSequenceRecording(take.sequence, take.cursor, end, null).sequence;
};
const filled = (sequence: MelodicSequence) => sequence.notes.flatMap((note, index) => note === null ? [] : [index + 1]);

describe('sequence quantization', () => {
  test('the early sliver in 10 becomes full notes in 11 and 12 only', () => {
    const sequence = recorded(9.93, 11.35);
    expect(filled(sequence)).toEqual([10, 11, 12]);
    const snapped = quantizeSequence(sequence);
    expect(filled(snapped)).toEqual([11, 12]);
    expect(snapped.attacks?.[10]).toBe(true);
    expect(snapped.attacks?.[11]).toBe(false);
    expect(snapped.gates?.slice(9, 12)).toEqual([null, null, null]);
  });

  test('snaps a late start back to its nearest step and rounds its release upward', () => {
    expect(filled(quantizeSequence(recorded(3.2, 4.3)))).toEqual([4, 5]);
    expect(filled(quantizeSequence(recorded(3.2, 4)))).toEqual([4]);
  });

  test('retains separate attacks for repeated notes in adjacent steps', () => {
    let take = advanceSequenceRecording(DEFAULT_SEQUENCE, null, .1, 33);
    take = advanceSequenceRecording(take.sequence, take.cursor, .65, null);
    take = advanceSequenceRecording(take.sequence, take.cursor, 1.1, 33);
    take = advanceSequenceRecording(take.sequence, take.cursor, 1.7, null);
    const snapped = quantizeSequence(take.sequence);
    expect(filled(snapped)).toEqual([1, 2]);
    expect(snapped.attacks?.slice(0, 2)).toEqual([true, true]);
    const schedule = buildSequenceSchedule({ sequence: snapped, startAt:0, now:0, until:.25, tempoBpm:120, fallbackRate:4 });
    expect(schedule.events.some(e => !e.gateOpen && e.at > .09 && e.at < .125)).toBe(true);
    expect(schedule.events.some(e => e.gateOpen && e.at === .125)).toBe(true);
    expect(quantizeSequence(snapped)).toEqual(snapped);
  });

  test('keeps a held note continuous, including across the loop edge', () => {
    const snapped = quantizeSequence(recorded(15.2, 16.4));
    expect(filled(snapped)).toEqual([1, 16]);
    expect(snapped.attacks?.[15]).toBe(true);
    expect(snapped.attacks?.[0]).toBe(false);
    expect(quantizeSequence(snapped)).toEqual(snapped);
    const schedule = buildSequenceSchedule({ sequence: snapped, startAt:0, now:1.91, until:2.1, tempoBpm:120, fallbackRate:4 });
    expect(schedule.events.every(e => e.gateOpen)).toBe(true);
  });

  test('keeps at least one step for tiny hits and remains monophonic on collisions', () => {
    expect(filled(quantizeSequence(recorded(2.9, 2.95)))).toEqual([4]);
    let take = advanceSequenceRecording(DEFAULT_SEQUENCE, null, .1, 31);
    take = advanceSequenceRecording(take.sequence, take.cursor, .15, null);
    take = advanceSequenceRecording(take.sequence, take.cursor, .3, 33);
    take = advanceSequenceRecording(take.sequence, take.cursor, .4, null);
    expect(quantizeSequence(take.sequence).notes[0]).toBe(33);
  });

  test('preserves hidden columns, enable state, and fully held loops', () => {
    const hidden = setSequenceNote(DEFAULT_SEQUENCE, 24, 40);
    expect(quantizeSequence(hidden)).toBe(hidden);
    const full = { ...DEFAULT_SEQUENCE, enabled: false, notes: Array(32).fill(33) };
    const snapped = quantizeSequence(setSequenceLength(full, 8));
    expect(snapped.enabled).toBe(false);
    expect(snapped.attacks?.slice(0, 8).some(Boolean)).toBe(false);
    expect(snapped.notes[24]).toBe(33);
  });
});
