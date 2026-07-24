import { describe, expect, test } from "vitest";
import {
  buildMidiClockSchedule,
  listMidiClockOutputs,
  midiClockOutputOptions,
  midiClockPulseIntervalMs,
  midiOutputFingerprint,
  midiOutputTopology,
  MIDI_CLOCK_PPQN,
  MIDI_START,
  MIDI_STOP,
  MIDI_TIMING_CLOCK,
  recommendedMidiClockOutputs,
  resolveMidiClockOutputs,
  restoreMidiClockOutputSelection,
} from "../app/earthscope/midiClock";
import {
  clampTempo,
  DEFAULT_TEMPO,
  TEMPO_MAX,
  TEMPO_MIN,
} from "../app/earthscope/tempo";

const MIDI_PORT = {
  id: "midi-1",
  manufacturer: "Akai Professional",
  name: "MPK mini IV MIDI Port",
  state: "connected",
};

const DAW_PORT = {
  id: "daw-1",
  manufacturer: "Akai Professional",
  name: "MPK mini IV DAW Port",
  state: "connected",
};

const DIN_PORT = {
  id: "din-1",
  manufacturer: "Akai Professional",
  name: "MPK mini IV DIN MIDI Port",
  state: "connected",
};

const CLARETT_PORT = {
  id: "clarett-1",
  manufacturer: "Focusrite",
  name: "Clarett 4Pre MIDI",
  state: "connected",
};

describe("MIDI clock", () => {
  test("uses the standard real-time transport messages and 24 PPQN", () => {
    expect(MIDI_TIMING_CLOCK).toBe(0xf8);
    expect(MIDI_START).toBe(0xfa);
    expect(MIDI_STOP).toBe(0xfc);
    expect(MIDI_CLOCK_PPQN).toBe(24);
  });

  test("clamps tempo to the shared musical range", () => {
    expect(DEFAULT_TEMPO).toBe(120);
    expect(clampTempo(TEMPO_MIN - 1)).toBe(TEMPO_MIN);
    expect(clampTempo(127.6)).toBe(128);
    expect(clampTempo(TEMPO_MAX + 1)).toBe(TEMPO_MAX);
  });

  test("schedules exactly 24 pulses per quarter note", () => {
    expect(midiClockPulseIntervalMs(120)).toBeCloseTo(20.833333);

    const schedule = buildMidiClockSchedule({
      nextPulseAt: 0,
      now: 0,
      tempoBpm: 120,
      until: 500,
    });

    expect(schedule.timestamps).toHaveLength(24);
    expect(schedule.timestamps[0]).toBe(0);
    expect(schedule.timestamps.at(-1)).toBeCloseTo(479.166667);
    expect(schedule.nextPulseAt).toBeCloseTo(500);
  });

  test("skips missed pulses instead of sending a burst", () => {
    const schedule = buildMidiClockSchedule({
      nextPulseAt: 0,
      now: 100,
      tempoBpm: 120,
      until: 150,
    });

    expect(schedule.timestamps[0]).toBeGreaterThanOrEqual(100);
    expect(schedule.timestamps).toHaveLength(3);
  });

  test("selects the documented MPK arp and physical DIN paths by default", () => {
    const outputs = [CLARETT_PORT, DIN_PORT, DAW_PORT, MIDI_PORT];

    expect(listMidiClockOutputs(outputs).map(({ id }) => id)).toEqual([
      "daw-1",
      "din-1",
      "midi-1",
      "clarett-1",
    ]);
    expect(
      recommendedMidiClockOutputs(outputs).map(({ id }) => id),
    ).toEqual(["daw-1", "din-1"]);
    expect(midiClockOutputOptions(outputs)[0]).toEqual({
      available: true,
      fingerprint: midiOutputFingerprint(DAW_PORT),
      id: "daw-1",
      name: "MPK mini IV DAW Port",
    });
  });

  test("falls back to the MPK MIDI path when no DIN output is exposed", () => {
    expect(
      recommendedMidiClockOutputs([MIDI_PORT, DAW_PORT]).map(
        ({ id }) => id,
      ),
    ).toEqual(["daw-1", "midi-1"]);
  });

  test("uses port ids for session identity and fingerprints for restoration", () => {
    const reenumerated = [
      { ...MIDI_PORT, id: "midi-2" },
      { ...DAW_PORT, id: "daw-2" },
    ];
    const resolved = resolveMidiClockOutputs(
      reenumerated,
      ["midi-2", "daw-2"],
    );

    expect(resolved.map(({ id }) => id)).toEqual(["daw-2", "midi-2"]);
    expect(midiOutputFingerprint(reenumerated[0])).toBe(
      midiOutputFingerprint(MIDI_PORT),
    );
  });

  test("never falls back to an unselected output", () => {
    expect(
      resolveMidiClockOutputs([CLARETT_PORT], ["midi-1", "daw-1"]),
    ).toEqual([]);
  });

  test("keeps identical ports independently selectable", () => {
    const secondMpk = { ...MIDI_PORT, id: "midi-2" };
    const options = midiClockOutputOptions([MIDI_PORT, secondMpk]);

    expect(options.map(({ id }) => id)).toEqual(["midi-1", "midi-2"]);
    expect(
      resolveMidiClockOutputs(
        [MIDI_PORT, secondMpk],
        ["midi-1", "midi-2"],
      ),
    ).toHaveLength(2);
  });

  test("restores duplicate preferences after ids change without collapsing them", () => {
    const fingerprint = midiOutputFingerprint(MIDI_PORT);
    const restored = restoreMidiClockOutputSelection(
      [
        { ...MIDI_PORT, id: "midi-3" },
        { ...MIDI_PORT, id: "midi-4" },
      ],
      ["midi-1", "midi-2"],
      new Map([[fingerprint, 2]]),
    );

    expect(restored).toEqual({
      missingFingerprints: [],
      selectedIds: ["midi-3", "midi-4"],
    });

    expect(
      restoreMidiClockOutputSelection(
        [{ ...MIDI_PORT, id: "midi-3" }],
        [],
        new Map([[fingerprint, 2]]),
      ),
    ).toEqual({
      missingFingerprints: [fingerprint],
      selectedIds: ["midi-3"],
    });
  });

  test("detects output-only topology changes", () => {
    expect(midiOutputTopology([MIDI_PORT, DAW_PORT])).not.toBe(
      midiOutputTopology([MIDI_PORT, DAW_PORT, CLARETT_PORT]),
    );
  });
});
