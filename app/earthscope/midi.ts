import {
  clampControl,
  CONTROL_SPECS,
  type VoiceControlKey,
  type VoiceControls,
} from "./controls";
import { positionToRepeatRate } from "./repeatRateScale";
import { positionToSampleCount } from "./sampleCountScale";

export type MidiKnobMode = "absolute" | "relative";

export const MPK_MINI_KNOB_CONTROLS: Readonly<Record<number, VoiceControlKey>> = {
  24: "sampleCount",
  25: "repeatsPerSecond",
  26: "cutoff",
  27: "resonance",
};

export const MPK_MINI_KEY_CHANNEL = 0;

const MIDI_KEY_TRANSPOSE_SEMITONES = -36;
// Preserve the established repeat-knob sensitivity after expanding the range.
const REPEAT_RATE_MIDI_RATIO = Math.pow(40 / 0.01, 1 / 256);
const SAMPLE_COUNT_MIDI_RATIO = 1.025;

export interface MidiInputLike {
  id: string;
  manufacturer?: string | null;
  name?: string | null;
  state?: string;
}

export interface MidiInputOption {
  id: string;
  name: string;
}

export interface MidiInputSelection<
  T extends MidiInputLike = MidiInputLike,
> {
  inputs: T[];
  key: string;
  name: string;
}

function normalizeMidiName(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function mpkMiniPairedPort(input: MidiInputLike) {
  const name = normalizeMidiName(input.name);
  if (
    !name.includes("mpk mini") ||
    /\b(?:din|plugin|software)\b/.test(name)
  ) {
    return null;
  }

  const match = name.match(/^(.*\bmpk mini\b.*?)\s+(midi|daw)\s+port$/);
  if (!match?.[1] || !match[2]) return null;

  return {
    baseName: match[1],
    role: match[2] as "midi" | "daw",
  };
}

function mpkMiniSelectionName(input: MidiInputLike) {
  const name = input.name?.trim().replace(/\s+/g, " ") ?? "MPK mini";
  return `${name.replace(/\s+(?:midi|daw)\s+port$/i, "")} MIDI + DAW Ports`;
}

function inputPriority(input: MidiInputLike) {
  const name = input.name?.toLowerCase() ?? "";
  if (!name.includes("mpk mini")) return 10;
  if (
    name.includes("midi port") &&
    !name.includes("daw") &&
    !name.includes("plugin") &&
    !name.includes("software") &&
    !name.includes("din")
  ) {
    return 0;
  }
  if (name.includes("software control")) return 2;
  if (name.includes("daw")) return 3;
  if (name.includes("plugin")) return 4;
  if (name.includes("din")) return 5;
  return 1;
}

export function midiInputFingerprint(input: MidiInputLike) {
  return `${normalizeMidiName(input.manufacturer)}:${normalizeMidiName(input.name)}`;
}

export function midiInputOption(input: MidiInputLike): MidiInputOption {
  return {
    id: input.id,
    name: input.name?.trim() || "MIDI input",
  };
}

export function midiInputSelectionKey(input: MidiInputLike) {
  const pairedPort = mpkMiniPairedPort(input);
  if (pairedPort) {
    return `mpk-mini:${normalizeMidiName(input.manufacturer)}:${pairedPort.baseName}`;
  }
  return `input:${midiInputFingerprint(input)}`;
}

export function listMidiInputs<T extends MidiInputLike>(inputs: Iterable<T>) {
  return [...inputs]
    .filter((input) => input.state !== "disconnected")
    .sort((left, right) => {
      const priority = inputPriority(left) - inputPriority(right);
      if (priority !== 0) return priority;
      return (left.name ?? "").localeCompare(right.name ?? "");
    });
}

export function listMidiInputSelections<T extends MidiInputLike>(
  inputs: Iterable<T>,
) {
  const selections: MidiInputSelection<T>[] = [];
  const pairedSelections = new Map<string, MidiInputSelection<T>>();

  for (const input of listMidiInputs(inputs)) {
    const pairedPort = mpkMiniPairedPort(input);
    const key = midiInputSelectionKey(input);
    if (!pairedPort) {
      selections.push({
        inputs: [input],
        key,
        name: midiInputOption(input).name,
      });
      continue;
    }

    const existing = pairedSelections.get(key);
    if (existing) {
      existing.inputs.push(input);
      continue;
    }

    const selection = {
      inputs: [input],
      key,
      name: mpkMiniSelectionName(input),
    };
    pairedSelections.set(key, selection);
    selections.push(selection);
  }

  return selections;
}

export function resolveMidiInputSelection<T extends MidiInputLike>(
  inputs: Iterable<T>,
  preferredSelectionKey: string | null = null,
) {
  const selections = listMidiInputSelections(inputs);
  if (preferredSelectionKey !== null) {
    return (
      selections.find(
        (selection) => selection.key === preferredSelectionKey,
      ) ?? null
    );
  }

  return (
    selections.find((selection) =>
      selection.inputs.some((input) => mpkMiniPairedPort(input) !== null),
    ) ??
    selections.find((selection) =>
      selection.inputs.some((input) => inputPriority(input) < 10),
    ) ??
    null
  );
}

export function resolveMidiInput<T extends MidiInputLike>(
  inputs: Iterable<T>,
  preferredFingerprint: string | null = null,
) {
  const available = listMidiInputs(inputs);
  if (preferredFingerprint !== null) {
    return (
      available.find(
        (input) => midiInputFingerprint(input) === preferredFingerprint,
      ) ?? null
    );
  }
  return available.find((input) => inputPriority(input) < 10) ?? null;
}

export function midiInputTopology(inputs: Iterable<MidiInputLike>) {
  return [...inputs]
    .map(
      (input) =>
        `${input.id}:${input.state ?? "unknown"}:${midiInputFingerprint(input)}`,
    )
    .sort()
    .join("|");
}

export function parseControlChange(data: ArrayLike<number>) {
  if (data.length < 3) return null;
  const status = data[0];
  const controller = data[1];
  const rawValue = data[2];
  if (
    status === undefined ||
    controller === undefined ||
    rawValue === undefined ||
    (status & 0xf0) !== 0xb0
  ) {
    return null;
  }
  return {
    channel: status & 0x0f,
    controller,
    rawValue,
  };
}

export interface MidiNoteMessage {
  channel: number;
  note: number;
  type: "on" | "off";
  velocity: number;
}

export function parseNoteMessage(
  data: ArrayLike<number>,
): MidiNoteMessage | null {
  if (data.length < 3) return null;
  const status = data[0];
  const note = data[1];
  const velocity = data[2];
  if (status === undefined || note === undefined || velocity === undefined) {
    return null;
  }

  const messageType = status & 0xf0;
  const isNoteOn = messageType === 0x90 && velocity > 0;
  const isNoteOff =
    messageType === 0x80 || (messageType === 0x90 && velocity === 0);
  if (!isNoteOn && !isNoteOff) return null;

  return {
    channel: status & 0x0f,
    note: Math.max(0, Math.min(127, Math.round(note))),
    type: isNoteOn ? "on" : "off",
    velocity: Math.max(0, Math.min(127, Math.round(velocity))),
  };
}

export function repeatRateForMidiNote(note: number) {
  const finiteNote = Number.isFinite(note) ? note : 0;
  const transposedNote = finiteNote + MIDI_KEY_TRANSPOSE_SEMITONES;
  return 440 * Math.pow(2, (transposedNote - 69) / 12);
}

export function playableRepeatRateForMidiNote(note: number) {
  const rate = repeatRateForMidiNote(note);
  const { min, max } = CONTROL_SPECS.repeatsPerSecond;
  return rate >= min && rate <= max ? rate : null;
}

export function updateHeldNotes(
  heldNotes: readonly number[],
  message: Pick<MidiNoteMessage, "note" | "type">,
) {
  if (message.type === "on") {
    return {
      heldNotes: [
        ...heldNotes.filter((note) => note !== message.note),
        message.note,
      ],
      selectedNote: message.note as number | undefined,
    };
  }

  const wasActive = heldNotes.at(-1) === message.note;
  const remainingNotes = heldNotes.filter((note) => note !== message.note);
  return {
    heldNotes: remainingNotes,
    selectedNote: wasActive ? remainingNotes.at(-1) : undefined,
  };
}

export function decodeRelativeMidiValue(rawValue: number) {
  const value = Math.max(0, Math.min(127, Math.round(rawValue)));
  if (value === 0 || value === 64) return 0;
  return value < 64 ? value : value - 128;
}

export interface RelativeSampleCountMovement {
  sampleCount: number;
  target: number;
}

export function moveSampleCountRelatively(
  target: number,
  delta: number,
): RelativeSampleCountMovement {
  const spec = CONTROL_SPECS.sampleCount;
  const finiteTarget = Number.isFinite(target) ? target : spec.min;
  const finiteDelta = Number.isFinite(delta) ? delta : 0;
  const scaledTarget =
    finiteTarget * Math.pow(SAMPLE_COUNT_MIDI_RATIO, finiteDelta);
  const nextTarget = Math.max(spec.min, Math.min(spec.max, scaledTarget));

  return {
    sampleCount: clampControl("sampleCount", nextTarget),
    target: nextTarget,
  };
}

export function applyMidiControl(
  controls: VoiceControls,
  controller: number,
  rawValue: number,
  mode: MidiKnobMode,
) {
  const key = MPK_MINI_KNOB_CONTROLS[controller];
  if (!key) return controls;

  const spec = CONTROL_SPECS[key];
  const value = Math.max(0, Math.min(127, Math.round(rawValue)));
  let nextValue: number;

  if (key === "sampleCount") {
    nextValue =
      mode === "relative"
        ? moveSampleCountRelatively(
            controls.sampleCount,
            decodeRelativeMidiValue(value),
          ).sampleCount
        : positionToSampleCount(value / 127);
  } else if (key === "repeatsPerSecond") {
    nextValue =
      mode === "relative"
        ? controls.repeatsPerSecond *
          Math.pow(
            REPEAT_RATE_MIDI_RATIO,
            decodeRelativeMidiValue(value),
          )
        : positionToRepeatRate(value / 127);
  } else {
    const midiStep = spec.midiStep ?? 0;
    nextValue =
      mode === "relative"
        ? controls[key] + decodeRelativeMidiValue(value) * midiStep
        : spec.min + (value / 127) * (spec.max - spec.min);
  }
  const clamped = clampControl(key, nextValue);

  if (clamped === controls[key]) return controls;
  return { ...controls, [key]: clamped };
}
