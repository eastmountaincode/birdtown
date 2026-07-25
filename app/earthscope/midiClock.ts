import { clampTempo } from "./tempo";

export const MIDI_TIMING_CLOCK = 0xf8;
export const MIDI_START = 0xfa;
export const MIDI_STOP = 0xfc;
export const MIDI_CLOCK_PPQN = 24;

export const MIDI_CLOCK_CLEARABLE_WINDOW = {
  lookaheadMs: 75_000,
  refillMs: 5_000,
} as const;

export const MIDI_CLOCK_ROLLING_WINDOW = {
  lookaheadMs: 5_000,
  refillMs: 1_000,
} as const;

export interface MidiOutputLike {
  id: string;
  manufacturer?: string | null;
  name?: string | null;
  state?: string;
}

export interface MidiClockOutputOption {
  available: boolean;
  fingerprint: string;
  id: string;
  name: string;
}

interface ClearableMidiOutput {
  clear?: () => void;
}

function clearMethod(output: object) {
  return (output as ClearableMidiOutput).clear;
}

export function canClearMidiOutputQueue(output: object) {
  return typeof clearMethod(output) === "function";
}

export function clearMidiOutputQueue(output: object) {
  if (!canClearMidiOutputQueue(output)) return false;
  clearMethod(output)?.call(output);
  return true;
}

export function midiClockScheduleWindow(
  outputs: Iterable<object>,
) {
  const available = [...outputs];
  return available.length > 0 &&
    available.every(canClearMidiOutputQueue)
    ? MIDI_CLOCK_CLEARABLE_WINDOW
    : MIDI_CLOCK_ROLLING_WINDOW;
}

function normalizeMidiName(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function outputPriority(output: MidiOutputLike) {
  const name = normalizeMidiName(output.name);
  if (!name.includes("mpk mini")) return 10;
  if (name.includes("daw port")) return 0;
  if (name.includes("din")) return 1;
  if (
    name.includes("midi port") &&
    !/\b(?:daw|din|plugin|software)\b/.test(name)
  ) {
    return 2;
  }
  if (name.includes("software")) return 3;
  if (name.includes("plugin")) return 4;
  return 5;
}

export function midiOutputFingerprint(output: MidiOutputLike) {
  return `${normalizeMidiName(output.manufacturer)}:${normalizeMidiName(output.name)}`;
}

export function listMidiClockOutputs<T extends MidiOutputLike>(
  outputs: Iterable<T>,
) {
  return [...outputs]
    .filter((output) => output.state !== "disconnected")
    .sort((left, right) => {
      const priority = outputPriority(left) - outputPriority(right);
      if (priority !== 0) return priority;
      return (left.name ?? "").localeCompare(right.name ?? "");
    });
}

export function midiClockOutputOptions(
  outputs: Iterable<MidiOutputLike>,
): MidiClockOutputOption[] {
  return listMidiClockOutputs(outputs).map((output) => ({
    available: true,
    fingerprint: midiOutputFingerprint(output),
    id: output.id,
    name: output.name?.trim() || "MIDI output",
  }));
}

export function recommendedMidiClockOutputs<T extends MidiOutputLike>(
  outputs: Iterable<T>,
) {
  const available = listMidiClockOutputs(outputs).filter((output) =>
    normalizeMidiName(output.name).includes("mpk mini"),
  );
  const dawOutputs = available.filter((output) =>
    normalizeMidiName(output.name).includes("daw port"),
  );
  const dinOutputs = available.filter((output) =>
    normalizeMidiName(output.name).includes("din"),
  );
  const physicalOutputs =
    dinOutputs.length > 0
      ? dinOutputs
      : available.filter((output) => outputPriority(output) === 2);
  return [...dawOutputs.slice(0, 1), ...physicalOutputs.slice(0, 1)];
}

export function resolveMidiClockOutputs<T extends MidiOutputLike>(
  outputs: Iterable<T>,
  selectedIds: Iterable<string>,
) {
  const selected = new Set(selectedIds);
  return listMidiClockOutputs(outputs).filter((output) =>
    selected.has(output.id),
  );
}

export function restoreMidiClockOutputSelection<T extends MidiOutputLike>(
  outputs: Iterable<T>,
  currentSelectedIds: Iterable<string>,
  preferences: ReadonlyMap<string, number>,
) {
  const available = listMidiClockOutputs(outputs);
  const current = new Set(currentSelectedIds);
  const remaining = new Map(preferences);
  const selectedIds: string[] = [];
  const selected = new Set<string>();

  const selectIfPreferred = (output: T) => {
    const fingerprint = midiOutputFingerprint(output);
    const count = remaining.get(fingerprint) ?? 0;
    if (count <= 0) return false;
    selectedIds.push(output.id);
    selected.add(output.id);
    if (count === 1) {
      remaining.delete(fingerprint);
    } else {
      remaining.set(fingerprint, count - 1);
    }
    return true;
  };

  for (const output of available) {
    if (current.has(output.id)) selectIfPreferred(output);
  }
  for (const output of available) {
    if (!selected.has(output.id)) selectIfPreferred(output);
  }

  const missingFingerprints: string[] = [];
  for (const [fingerprint, count] of remaining) {
    for (let index = 0; index < count; index += 1) {
      missingFingerprints.push(fingerprint);
    }
  }

  return { missingFingerprints, selectedIds };
}

export function midiOutputTopology(outputs: Iterable<MidiOutputLike>) {
  return [...outputs]
    .map(
      (output) =>
        `${output.id}:${output.state ?? "unknown"}:${midiOutputFingerprint(output)}`,
    )
    .sort()
    .join("|");
}

export function midiClockPulseIntervalMs(tempoBpm: number) {
  return 60_000 / (clampTempo(tempoBpm) * MIDI_CLOCK_PPQN);
}

export function buildMidiClockSchedule({
  nextPulseAt,
  now,
  tempoBpm,
  until,
}: {
  nextPulseAt: number;
  now: number;
  tempoBpm: number;
  until: number;
}) {
  const interval = midiClockPulseIntervalMs(tempoBpm);
  let timestamp = nextPulseAt;

  if (timestamp < now) {
    timestamp += Math.ceil((now - timestamp) / interval) * interval;
  }

  const timestamps: number[] = [];
  const boundaryTolerance = interval / 1_000_000;
  while (timestamp < until - boundaryTolerance) {
    timestamps.push(timestamp);
    timestamp += interval;
  }

  return {
    nextPulseAt: timestamp,
    timestamps,
  };
}
