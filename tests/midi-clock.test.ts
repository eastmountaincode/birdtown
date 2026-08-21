import { describe, expect, test } from "vitest";
import {
  buildMidiClockSchedule,
  canClearMidiOutputQueue,
  clearMidiOutputQueue,
  externalClockTransportStartAt,
  listMidiClockInputs,
  listMidiClockOutputs,
  MIDI_CLOCK_CLEARABLE_WINDOW,
  midiClockTempoFromIntervals,
  midiClockOutputOptions,
  midiClockInputOptions,
  midiClockPulseIntervalMs,
  MIDI_CLOCK_ROLLING_WINDOW,
  midiClockScheduleWindow,
  midiClockStartTiming,
  midiOutputFingerprint,
  midiOutputTopology,
  midiInputFingerprint,
  MIDI_CLOCK_PPQN,
  MIDI_CONTINUE,
  MIDI_START,
  MIDI_STOP,
  MIDI_TIMING_CLOCK,
  parseMidiRealtimeMessage,
  recommendedMidiClockInput,
  recommendedMidiClockOutputs,
  resolveMidiClockOutputs,
  restoreMidiClockInput,
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

const MPK_INPUT = {
  id: "mpk-input-1",
  manufacturer: "Akai Professional",
  name: "MPK mini IV MIDI Port",
  state: "connected",
};

const CLARETT_INPUT = {
  id: "clarett-input-1",
  manufacturer: "Focusrite",
  name: "Clarett 4Pre MIDI",
  state: "connected",
};

describe("MIDI clock", () => {
  test("uses the standard real-time transport messages and 24 PPQN", () => {
    expect(MIDI_TIMING_CLOCK).toBe(0xf8);
    expect(MIDI_START).toBe(0xfa);
    expect(MIDI_CONTINUE).toBe(0xfb);
    expect(MIDI_STOP).toBe(0xfc);
    expect(MIDI_CLOCK_PPQN).toBe(24);
  });

  test("decodes only MIDI real-time clock and transport messages", () => {
    expect(parseMidiRealtimeMessage([MIDI_TIMING_CLOCK])).toBe("clock");
    expect(parseMidiRealtimeMessage([MIDI_START])).toBe("start");
    expect(parseMidiRealtimeMessage([MIDI_CONTINUE])).toBe("continue");
    expect(parseMidiRealtimeMessage([MIDI_STOP])).toBe("stop");
    expect(parseMidiRealtimeMessage([0x90, 60, 127])).toBeNull();
    expect(parseMidiRealtimeMessage([])).toBeNull();
  });

  test("derives tempo from incoming pulses without letting one delay skew it", () => {
    const pulseInterval = 60_000 / (120 * MIDI_CLOCK_PPQN);
    const intervals = [
      ...Array<number>(23).fill(pulseInterval),
      pulseInterval * 4,
    ];

    expect(midiClockTempoFromIntervals(intervals)).toBeCloseTo(120);
    expect(midiClockTempoFromIntervals([])).toBeNull();
  });

  test("keeps neighboring jittered clock windows on the actual whole BPM", () => {
    const fasterMedianWindow = [
      ...Array<number>(52).fill(12.5),
      ...Array<number>(44).fill(12.625),
    ];
    const slowerMedianWindow = [
      ...Array<number>(44).fill(12.5),
      ...Array<number>(52).fill(12.625),
    ];

    expect(
      Math.round(midiClockTempoFromIntervals(fasterMedianWindow) ?? 0),
    ).toBe(199);
    expect(
      Math.round(midiClockTempoFromIntervals(slowerMedianWindow) ?? 0),
    ).toBe(199);
  });

  test("rebases the shared transport to the incoming pulse position", () => {
    expect(
      externalClockTransportStartAt({
        pulseAtMs: 1_000,
        pulseCount: 12,
        tempoBpm: 120,
      }),
    ).toBeCloseTo(750);
  });

  test("keeps clock inputs separate and recommends external hardware", () => {
    expect(
      listMidiClockInputs([MPK_INPUT, CLARETT_INPUT]).map(({ id }) => id),
    ).toEqual(["clarett-input-1", "mpk-input-1"]);
    expect(recommendedMidiClockInput([MPK_INPUT, CLARETT_INPUT])?.id).toBe(
      "clarett-input-1",
    );
    expect(midiClockInputOptions([CLARETT_INPUT])).toEqual([
      { id: "clarett-input-1", name: "Clarett 4Pre MIDI" },
    ]);
  });

  test("restores the selected clock input after CoreMIDI changes its id", () => {
    const reenumerated = { ...CLARETT_INPUT, id: "clarett-input-2" };
    expect(
      restoreMidiClockInput(
        [reenumerated, MPK_INPUT],
        CLARETT_INPUT.id,
        midiInputFingerprint(CLARETT_INPUT),
      )?.id,
    ).toBe("clarett-input-2");
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

  test("sends Start before the shared downbeat and first clock pulse", () => {
    const timing = midiClockStartTiming(1_000);

    expect(timing.startMessageAt).toBe(1_010);
    expect(timing.downbeatAt).toBe(1_020);
    expect(timing.startMessageAt).toBeLessThan(timing.downbeatAt);
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

  test("uses a rolling queue when the browser cannot clear scheduled output", () => {
    expect(canClearMidiOutputQueue({})).toBe(false);
    expect(clearMidiOutputQueue({})).toBe(false);
    expect(midiClockScheduleWindow([{}])).toBe(
      MIDI_CLOCK_ROLLING_WINDOW,
    );
  });

  test("keeps the long hidden-tab queue when every output can clear it", () => {
    let clearCount = 0;
    const output = {
      clear: () => {
        clearCount += 1;
      },
    };

    expect(canClearMidiOutputQueue(output)).toBe(true);
    expect(clearMidiOutputQueue(output)).toBe(true);
    expect(clearCount).toBe(1);
    expect(midiClockScheduleWindow([output, output])).toBe(
      MIDI_CLOCK_CLEARABLE_WINDOW,
    );
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
