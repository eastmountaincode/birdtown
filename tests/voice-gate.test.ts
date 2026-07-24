import { describe, expect, test } from "vitest";
import { voiceGateOpen } from "../app/earthscope/voiceGate";

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
});
