export function voiceGateOpen(
  latchEnabled: boolean,
  hasHeldKeys: boolean,
) {
  return latchEnabled || hasHeldKeys;
}

export function sourceGateOpen(
  manualGateOpen: boolean,
  sequencerRunning: boolean,
) {
  return manualGateOpen || sequencerRunning;
}
