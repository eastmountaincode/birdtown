import { describe, expect, test } from "vitest";
import {
  sequenceControlsVoice,
  sourceGateOpen,
  voiceGateOpen,
} from "../app/earthscope/voiceGate";

describe("voice gate", () => {
  test.each([
    {
      hasHeldKeys: false,
      latchEnabled: false,
      open: false,
    },
    {
      hasHeldKeys: true,
      latchEnabled: false,
      open: true,
    },
    {
      hasHeldKeys: false,
      latchEnabled: true,
      open: true,
    },
    {
      hasHeldKeys: true,
      latchEnabled: true,
      open: true,
    },
  ])(
    "is $open when latch=$latchEnabled and held keys=$hasHeldKeys",
    ({ hasHeldKeys, latchEnabled, open }) => {
      expect(voiceGateOpen(latchEnabled, hasHeldKeys)).toBe(open);
    },
  );

  test.each([
    {
      manualGateOpen: false,
      open: false,
      sequencerRunning: false,
    },
    {
      manualGateOpen: true,
      open: true,
      sequencerRunning: false,
    },
    {
      manualGateOpen: false,
      open: true,
      sequencerRunning: true,
    },
    {
      manualGateOpen: true,
      open: true,
      sequencerRunning: true,
    },
  ])(
    "keeps the source gate $open when manual=$manualGateOpen and sequencer=$sequencerRunning",
    ({ manualGateOpen, open, sequencerRunning }) => {
      expect(sourceGateOpen(manualGateOpen, sequencerRunning)).toBe(open);
    },
  );

  test.each([
    {
      midiOverrideActive: false,
      ownsVoice: false,
      sequencerRunning: false,
    },
    {
      midiOverrideActive: true,
      ownsVoice: false,
      sequencerRunning: false,
    },
    {
      midiOverrideActive: false,
      ownsVoice: true,
      sequencerRunning: true,
    },
    {
      midiOverrideActive: true,
      ownsVoice: false,
      sequencerRunning: true,
    },
  ])(
    "gives the sequencer voice ownership=$ownsVoice when running=$sequencerRunning and MIDI override=$midiOverrideActive",
    ({ midiOverrideActive, ownsVoice, sequencerRunning }) => {
      expect(
        sequenceControlsVoice(sequencerRunning, midiOverrideActive),
      ).toBe(ownsVoice);
    },
  );
});
