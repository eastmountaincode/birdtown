import { EARTHSCOPE_MAX_SAMPLES } from "../lib/earthScopeConfig";

export const C5_REPEATS_PER_SECOND =
  440 * Math.pow(2, (72 - 69) / 12);

export interface VoiceControls {
  cutoff: number;
  repeatsPerSecond: number;
  resonance: number;
  sampleCount: number;
  volume: number;
}

export type VoiceControlKey = keyof VoiceControls;

interface ControlSpec {
  max: number;
  midiStep: number | null;
  min: number;
  precision: number;
  step: number | "any";
}

export const CONTROL_SPECS: Record<VoiceControlKey, ControlSpec> = {
  sampleCount: {
    min: 4,
    max: EARTHSCOPE_MAX_SAMPLES,
    step: 1,
    midiStep: null,
    precision: 0,
  },
  repeatsPerSecond: {
    min: 0.01,
    max: C5_REPEATS_PER_SECOND,
    step: "any",
    midiStep: null,
    precision: 2,
  },
  cutoff: {
    min: 80,
    max: 2400,
    step: 10,
    midiStep: 20,
    precision: 0,
  },
  resonance: {
    min: 0.5,
    max: 18,
    step: 0.1,
    midiStep: 0.2,
    precision: 2,
  },
  volume: {
    min: 0,
    max: 1,
    step: 0.01,
    midiStep: 0.02,
    precision: 2,
  },
};

export const DEFAULT_CONTROLS: VoiceControls = {
  cutoff: 420,
  repeatsPerSecond: 4,
  resonance: 3,
  sampleCount: 100,
  volume: 1,
};

export function clampControl(key: VoiceControlKey, value: number) {
  const spec = CONTROL_SPECS[key];
  const finiteValue = Number.isFinite(value) ? value : spec.min;
  const clamped = Math.max(spec.min, Math.min(spec.max, finiteValue));
  if (spec.step === "any") return clamped;
  const stepped =
    spec.min + Math.round((clamped - spec.min) / spec.step) * spec.step;
  return Number(stepped.toFixed(spec.precision));
}

export function effectiveLoopSampleCount(
  requestedSampleCount: number,
  availableSamples: number,
) {
  const available = Number.isFinite(availableSamples)
    ? Math.max(0, Math.floor(availableSamples))
    : 0;
  return Math.min(clampControl("sampleCount", requestedSampleCount), available);
}
