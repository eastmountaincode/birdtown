import { afterEach, expect, test, vi } from 'vitest';
import type { MelodicSequence } from '../app/earthscope/sequencer';

const harness = vi.hoisted(() => ({ states: [] as unknown[], tick: () => {} }));
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useCallback: (fn: unknown) => fn,
  useState: (initial: unknown) => {
    const index = harness.states.length;
    harness.states.push(initial);
    return [initial, (update: unknown) => {
      harness.states[index] = typeof update === 'function' ? update(harness.states[index]) : update;
    }];
  },
}));
vi.mock('../app/earthscope/useSequencerPlayhead', () => ({
  useSequencerPlayhead: (_sequence: unknown, _transport: unknown, _tempo: number, tick: () => void) => {
    harness.tick = tick; return null;
  },
}));
import { useMelodicSequencer } from '../app/earthscope/useMelodicSequencer';
afterEach(() => { vi.restoreAllMocks(); harness.states = []; });

test('MIDI releases record between visual ticks; Record Off closes held notes', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const sequencer = useMelodicSequencer(120);
  sequencer.setClockTransport(true, 0);
  sequencer.setRecording(true);
  sequencer.setActiveMidiNote(69, 10);
  sequencer.setActiveMidiNote(null, 50);
  sequencer.setActiveMidiNote(69, 80);
  sequencer.setActiveMidiNote(null, 110);
  const sequence = (harness.states[0] as { sequence: MelodicSequence }).sequence;
  expect(sequence.gates?.[0]).toEqual([{ start:.08, end:.4 }, { start:.64, end:.88 }]);
  sequencer.setActiveMidiNote(69, 125);
  now = 175;
  sequencer.setRecording(false);
  expect((harness.states[0] as { sequence: MelodicSequence }).sequence.gates?.[1]?.[0].end).toBeCloseTo(.4);
});

test('recording before clock start and stopping without a visual tick preserve release time', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const sequencer = useMelodicSequencer(120);
  sequencer.setRecording(true);
  sequencer.setActiveMidiNote(69);
  sequencer.setClockTransport(true, 0);
  now = 75;
  sequencer.setClockTransport(false, null);
  const sequence = (harness.states[0] as { sequence: MelodicSequence }).sequence;
  expect(sequence.gates?.[0]).toEqual([{ start:0, end:.6 }]);
});
