import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DEFAULT_CONTROLS } from '../app/earthscope/controls';
import { DEFAULT_LOW_PASS_LFO } from '../app/earthscope/lowPassLfo';

const harness = vi.hoisted(() => ({ effects: [] as (() => unknown)[] }));
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => unknown) => { harness.effects.push(fn); },
  useState: (initial: unknown) => {
    let value = typeof initial === 'function' ? initial() : initial;
    return [value, (update: unknown) => { value = typeof update === 'function' ? update(value) : update; }];
  },
}));
import { useMidiControls } from '../app/earthscope/useMidiControls';

let saved: Map<string, string>;
beforeEach(() => {
  harness.effects = [];
  saved = new Map();
  vi.stubGlobal('window', {
    clearTimeout, setTimeout,
    localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) },
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup() {
  const input = { id: 'mpk-midi', name: 'MPK mini IV MIDI Port', manufacturer: 'Akai', type: 'input', state: 'connected', connection: 'open', open: vi.fn(async () => input), close: vi.fn(async () => input), onmidimessage: null as ((event: unknown) => void) | null };
  const daw = { ...input, id: 'mpk-daw', name: 'MPK mini IV DAW Port' };
  const access = { inputs: new Map([[input.id, input], [daw.id, daw]]), outputs: new Map(), onstatechange: null };
  vi.stubGlobal('navigator', { requestMIDIAccess: async () => access });
  const callbacks = {
    onActiveNoteChange: vi.fn(), onHeldKeysChange: vi.fn(), setControls: vi.fn(),
    setLowPassLfo: vi.fn(), setPitchBendRatio: vi.fn(), setRepeatsPerSecond: vi.fn(),
  };
  // The hook runs against the test hook harness above.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const midi = useMidiControls({ controls: DEFAULT_CONTROLS, lowPassLfo: DEFAULT_LOW_PASS_LFO, ...callbacks });
  harness.effects.forEach(effect => effect());
  await Promise.resolve();
  await midi.connect();
  const send = (data: number[], port = input) => port.onmidimessage?.({ data: Uint8Array.from(data), timeStamp: 123 });
  return { midi, input, daw, access, send, ...callbacks };
}

test('Keys Off releases live notes and bend, blocks playing/recording, preserves knobs and MIDI access', async () => {
  const h = await setup();
  h.send([0x90, 48, 100]);
  expect(h.onActiveNoteChange).toHaveBeenLastCalledWith(48, 123);
  expect(h.onHeldKeysChange).toHaveBeenLastCalledWith(true);
  h.send([0xe0, 127, 127]);
  expect(h.setPitchBendRatio.mock.lastCall?.[0]).not.toBe(1);
  h.midi.setKeysEnabled(false);
  expect(h.onActiveNoteChange.mock.lastCall?.[0]).toBe(null);
  expect(h.onHeldKeysChange).toHaveBeenLastCalledWith(false);
  expect(h.setPitchBendRatio).toHaveBeenLastCalledWith(1);
  h.onActiveNoteChange.mockClear(); h.setRepeatsPerSecond.mockClear(); h.setPitchBendRatio.mockClear();
  h.send([0x90, 52, 127]); h.send([0x80, 48, 0]); h.send([0xe0, 0, 0]);
  expect(h.onActiveNoteChange).not.toHaveBeenCalled();
  expect(h.setRepeatsPerSecond).not.toHaveBeenCalled();
  expect(h.setPitchBendRatio).not.toHaveBeenCalled();
  h.send([0xb0, 24, 1], h.daw);
  expect(h.setControls).toHaveBeenCalled();
  expect(h.input.close).not.toHaveBeenCalled();
  expect(h.access.onstatechange).toBeTypeOf('function');
  expect(saved.get('birdtown-midi-keys-enabled')).toBe('false');
  h.midi.setKeysEnabled(true);
  expect(h.onActiveNoteChange).not.toHaveBeenCalled();
  h.send([0x90, 55, 10]);
  expect(h.onActiveNoteChange).toHaveBeenLastCalledWith(55, 123);
  h.send([0x90, 55, 0]);
  expect(h.onActiveNoteChange).toHaveBeenLastCalledWith(null, 123);
});

test('saved Keys Off survives reload and MIDI disconnect/reconnect', async () => {
  saved.set('birdtown-midi-keys-enabled', 'false');
  const h = await setup();
  h.send([0x90, 48, 100]);
  expect(h.onActiveNoteChange).not.toHaveBeenCalled();
  h.midi.disconnect(); await h.midi.connect();
  h.send([0x90, 50, 100]);
  expect(h.onActiveNoteChange).not.toHaveBeenCalled();
});
