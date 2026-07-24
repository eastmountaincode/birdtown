import { describe, expect, test } from "vitest";
import {
  C3_REPEATS_PER_SECOND,
  CONTROL_SPECS,
  DEFAULT_CONTROLS,
  type VoiceControls,
} from "../app/earthscope/controls";
import {
  applyMidiControl,
  decodeRelativeMidiValue,
  listMidiInputSelections,
  listMidiInputs,
  midiInputFingerprint,
  midiInputSelectionKey,
  midiInputTopology,
  moveSampleCountRelatively,
  MPK_MINI_KEY_CHANNEL,
  MPK_MINI_KNOB_CONTROLS,
  parseControlChange,
  parseNoteMessage,
  playableRepeatRateForMidiNote,
  repeatRateForMidiNote,
  resolveMidiInput,
  resolveMidiInputSelection,
  updateHeldNotes,
} from "../app/earthscope/midi";
import { voiceGateOpen } from "../app/earthscope/voiceGate";

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

const CLARETT_PORT = {
  id: "clarett-1",
  manufacturer: "Focusrite",
  name: "Clarett 4Pre MIDI",
  state: "connected",
};

const SOFTWARE_CONTROL_PORT = {
  id: "software-1",
  manufacturer: "Akai Professional",
  name: "MPK mini IV Software Control",
  state: "connected",
};

const PLUGIN_PORT = {
  id: "plugin-1",
  manufacturer: "Akai Professional",
  name: "MPK mini IV Plugin",
  state: "connected",
};

const DIN_PORT = {
  id: "din-1",
  manufacturer: "Akai Professional",
  name: "MPK mini IV DIN MIDI Port",
  state: "connected",
};

describe("MPK mini controls", () => {
  test("maps the observed MPK mini IV knob CCs deterministically", () => {
    expect(MPK_MINI_KNOB_CONTROLS).toEqual({
      24: "sampleCount",
      25: "repeatsPerSecond",
      26: "cutoff",
      27: "resonance",
    });
  });

  test("prefers the MPK MIDI port regardless of enumeration order", () => {
    const listed = listMidiInputs([CLARETT_PORT, DAW_PORT, MIDI_PORT]);
    expect(listed.map((input) => input.name)).toEqual([
      "MPK mini IV MIDI Port",
      "MPK mini IV DAW Port",
      "Clarett 4Pre MIDI",
    ]);
    expect(resolveMidiInput(listed)?.id).toBe(MIDI_PORT.id);
  });

  test("does not silently use a non-MPK input as the default", () => {
    expect(resolveMidiInput([CLARETT_PORT])).toBeNull();
  });

  test("groups the MPK MIDI and DAW ports into one logical selection", () => {
    const selections = listMidiInputSelections([
      CLARETT_PORT,
      DAW_PORT,
      MIDI_PORT,
    ]);

    expect(selections).toHaveLength(2);
    expect(selections[0]).toEqual({
      inputs: [MIDI_PORT, DAW_PORT],
      key: midiInputSelectionKey(MIDI_PORT),
      name: "MPK mini IV MIDI + DAW Ports",
    });
    expect(selections[1]).toEqual({
      inputs: [CLARETT_PORT],
      key: midiInputSelectionKey(CLARETT_PORT),
      name: "Clarett 4Pre MIDI",
    });
    expect(midiInputSelectionKey(MIDI_PORT)).toBe(
      midiInputSelectionKey(DAW_PORT),
    );
    expect(resolveMidiInputSelection(selections.flatMap(({ inputs }) => inputs)))
      .toEqual(selections[0]);
  });

  test("restores an MPK pair across partial availability and new ids", () => {
    const selectionKey = midiInputSelectionKey(DAW_PORT);
    const midiOnly = resolveMidiInputSelection([MIDI_PORT], selectionKey);
    const dawOnly = resolveMidiInputSelection([DAW_PORT], selectionKey);
    const rejoined = resolveMidiInputSelection(
      [
        { ...DAW_PORT, id: "daw-2" },
        { ...MIDI_PORT, id: "midi-2" },
      ],
      selectionKey,
    );

    expect(midiOnly?.inputs.map(({ id }) => id)).toEqual(["midi-1"]);
    expect(dawOnly?.inputs.map(({ id }) => id)).toEqual(["daw-1"]);
    expect(rejoined?.inputs.map(({ id }) => id)).toEqual([
      "midi-2",
      "daw-2",
    ]);
    expect(rejoined?.key).toBe(selectionKey);
  });

  test("keeps non-paired MPK and Clarett ports individually selectable", () => {
    const ports = [
      SOFTWARE_CONTROL_PORT,
      PLUGIN_PORT,
      DIN_PORT,
      CLARETT_PORT,
    ];
    const selections = listMidiInputSelections(ports);

    expect(selections).toHaveLength(ports.length);
    expect(selections.every(({ inputs }) => inputs.length === 1)).toBe(true);
    expect(selections.map(({ name }) => name)).toEqual([
      "MPK mini IV Software Control",
      "MPK mini IV Plugin",
      "MPK mini IV DIN MIDI Port",
      "Clarett 4Pre MIDI",
    ]);
    expect(
      selections.map(({ key }) => key),
    ).not.toContain(midiInputSelectionKey(MIDI_PORT));

    const clarettKey = midiInputSelectionKey(CLARETT_PORT);
    expect(
      resolveMidiInputSelection(
        [{ ...CLARETT_PORT, id: "clarett-2" }],
        clarettKey,
      )?.inputs[0]?.id,
    ).toBe("clarett-2");
  });

  test("honors an explicit DAW-port selection", () => {
    const preference = midiInputFingerprint(DAW_PORT);
    expect(resolveMidiInput([MIDI_PORT, DAW_PORT], preference)?.id).toBe(
      DAW_PORT.id,
    );
  });

  test("restores a selected port after CoreMIDI gives it a new id", () => {
    const preference = midiInputFingerprint(MIDI_PORT);
    const reenumerated = { ...MIDI_PORT, id: "midi-2" };
    expect(resolveMidiInput([reenumerated], preference)?.id).toBe("midi-2");
  });

  test("notices Clarett topology changes without changing the MPK preference", () => {
    const preference = midiInputFingerprint(MIDI_PORT);
    expect(midiInputTopology([MIDI_PORT, DAW_PORT])).not.toBe(
      midiInputTopology([MIDI_PORT, DAW_PORT, CLARETT_PORT]),
    );
    expect(
      resolveMidiInput([CLARETT_PORT, DAW_PORT, MIDI_PORT], preference)?.id,
    ).toBe(MIDI_PORT.id);
  });

  test("waits for a missing explicit input instead of silently switching", () => {
    const preference = midiInputFingerprint(MIDI_PORT);
    expect(resolveMidiInput([CLARETT_PORT, DAW_PORT], preference)).toBeNull();
  });

  test("parses control changes separately from note messages", () => {
    expect(parseControlChange([0xb2, 24, 127])).toEqual({
      channel: 2,
      controller: 24,
      rawValue: 127,
    });
    expect(parseControlChange([0x90, 60, 100])).toBeNull();

    expect(MPK_MINI_KEY_CHANNEL).toBe(0);
    expect(parseNoteMessage([0x90, 60, 100])).toEqual({
      channel: 0,
      note: 60,
      type: "on",
      velocity: 100,
    });
    expect(parseNoteMessage([0x80, 60, 45])).toEqual({
      channel: 0,
      note: 60,
      type: "off",
      velocity: 45,
    });
    expect(parseNoteMessage([0x90, 60, 0])?.type).toBe("off");
    expect(parseNoteMessage([0xb0, 24, 1])).toBeNull();
  });

  test("preserves the centered bass range and extends octave-up to C3", () => {
    expect(repeatRateForMidiNote(48)).toBeCloseTo(16.3515978);
    expect(repeatRateForMidiNote(60)).toBeCloseTo(32.7031957);
    expect(repeatRateForMidiNote(69)).toBeCloseTo(55);
    expect(repeatRateForMidiNote(72)).toBeCloseTo(65.4063913);
    expect(repeatRateForMidiNote(60) / repeatRateForMidiNote(48)).toBeCloseTo(
      2,
    );
    expect(playableRepeatRateForMidiNote(72)).toBeCloseTo(65.4063913);
    expect(playableRepeatRateForMidiNote(84)).toBeCloseTo(
      C3_REPEATS_PER_SECOND,
    );
    expect(playableRepeatRateForMidiNote(85)).toBeNull();
  });

  test("keeps a momentary gate open until the final key is released", () => {
    const first = updateHeldNotes([], { note: 48, type: "on" });
    const second = updateHeldNotes(first.heldNotes, {
      note: 55,
      type: "on",
    });
    const fallback = updateHeldNotes(second.heldNotes, {
      note: 55,
      type: "off",
    });
    const latched = updateHeldNotes(fallback.heldNotes, {
      note: 48,
      type: "off",
    });

    expect(first).toEqual({ heldNotes: [48], selectedNote: 48 });
    expect(second).toEqual({ heldNotes: [48, 55], selectedNote: 55 });
    expect(fallback).toEqual({ heldNotes: [48], selectedNote: 48 });
    expect(latched).toEqual({ heldNotes: [], selectedNote: undefined });
    expect(voiceGateOpen(false, first.heldNotes.length > 0)).toBe(true);
    expect(voiceGateOpen(false, second.heldNotes.length > 0)).toBe(true);
    expect(voiceGateOpen(false, fallback.heldNotes.length > 0)).toBe(true);
    expect(voiceGateOpen(false, latched.heldNotes.length > 0)).toBe(false);
    expect(voiceGateOpen(true, latched.heldNotes.length > 0)).toBe(true);
  });

  test("relative sample-count movement accumulates fine detail at the bottom", () => {
    let target = CONTROL_SPECS.sampleCount.min;
    const values: number[] = [];

    for (let index = 0; index < 5; index += 1) {
      const movement = moveSampleCountRelatively(target, 1);
      target = movement.target;
      values.push(movement.sampleCount);
    }

    expect(values).toEqual([4, 4, 4, 4, 5]);
  });

  test("relative sample-count movement accelerates before one hundred", () => {
    expect(moveSampleCountRelatively(14, 1).sampleCount).toBe(14);
    expect(moveSampleCountRelatively(42, 1).sampleCount).toBe(43);
    expect(moveSampleCountRelatively(96, 1).sampleCount).toBe(98);
    expect(moveSampleCountRelatively(1_000, 1).sampleCount).toBe(1_025);
  });

  test("relative sample-count movement reverses without hysteresis", () => {
    for (const sampleCount of [8, 14, 42, 96, 1_000]) {
      const upward = moveSampleCountRelatively(sampleCount, 1);
      const backDown = moveSampleCountRelatively(upward.target, -1);
      const downward = moveSampleCountRelatively(sampleCount, -1);
      const backUp = moveSampleCountRelatively(downward.target, 1);

      expect(backDown.target).toBeCloseTo(sampleCount);
      expect(backDown.sampleCount).toBe(sampleCount);
      expect(backUp.target).toBeCloseTo(sampleCount);
      expect(backUp.sampleCount).toBe(sampleCount);
    }

    const bottomUp = moveSampleCountRelatively(4, 1);
    expect(moveSampleCountRelatively(bottomUp.target, -1).target).toBeCloseTo(
      4,
    );
    const floor = moveSampleCountRelatively(4, -20);
    expect(floor).toEqual({ sampleCount: 4, target: 4 });
    expect(moveSampleCountRelatively(floor.target, 1).target).toBeCloseTo(4.1);
  });

  test("relative sample-count deltas preserve their fractional motion", () => {
    const combined = moveSampleCountRelatively(72, 5);
    let repeatedTarget = 72;
    let repeatedSampleCount = 72;

    for (let index = 0; index < 5; index += 1) {
      const movement = moveSampleCountRelatively(repeatedTarget, 1);
      repeatedTarget = movement.target;
      repeatedSampleCount = movement.sampleCount;
    }

    expect(combined.target).toBeCloseTo(repeatedTarget);
    expect(combined.sampleCount).toBe(repeatedSampleCount);
    expect(moveSampleCountRelatively(4, -1).sampleCount).toBe(4);
  });

  test("relative repeat-rate movement stays proportional across the range", () => {
    const low: VoiceControls = { ...DEFAULT_CONTROLS, repeatsPerSecond: 0.02 };
    const high: VoiceControls = { ...DEFAULT_CONTROLS, repeatsPerSecond: 10 };

    const nextLow =
      applyMidiControl(low, 25, 1).repeatsPerSecond;
    const nextHigh =
      applyMidiControl(high, 25, 1).repeatsPerSecond;

    expect(nextLow / low.repeatsPerSecond).toBeCloseTo(
      nextHigh / high.repeatsPerSecond,
      10,
    );
    expect(nextLow).toBeLessThan(0.021);
    expect(decodeRelativeMidiValue(127)).toBe(-1);
    expect(decodeRelativeMidiValue(64)).toBe(0);
  });

  test("relative resonance steps stay uniform after quantization", () => {
    const first = applyMidiControl(DEFAULT_CONTROLS, 27, 1);
    const second = applyMidiControl(first, 27, 1);

    expect(first.resonance - DEFAULT_CONTROLS.resonance).toBeCloseTo(0.2);
    expect(second.resonance - first.resonance).toBeCloseTo(0.2);
  });

  test("ignores unrelated controllers", () => {
    expect(applyMidiControl(DEFAULT_CONTROLS, 74, 127)).toBe(
      DEFAULT_CONTROLS,
    );
  });
});
