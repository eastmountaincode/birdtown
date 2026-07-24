export function voiceGateOpen(
  latchEnabled: boolean,
  hasHeldKeys: boolean,
) {
  return latchEnabled || hasHeldKeys;
}
