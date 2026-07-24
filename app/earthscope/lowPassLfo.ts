import { clampControl, CONTROL_SPECS } from "./controls";

export interface LowPassLfoSettings {
  depth: number;
  rate: number;
  tempoBpm: number;
  timing: LowPassLfoTiming;
}

export type LowPassLfoKey = "depth" | "rate" | "tempoBpm";

export const LOW_PASS_LFO_RATE_MIN = 0.01;
export const LOW_PASS_LFO_RATE_MAX = 20;
export const LOW_PASS_LFO_MINIMUM_FREQUENCY = 20;
export const LOW_PASS_LFO_TEMPO_MIN = 30;
export const LOW_PASS_LFO_TEMPO_MAX = 300;

export const LOW_PASS_LFO_TIMINGS = [
  { beats: null, label: "Free", value: "free" },
  { beats: 4, label: "1/1", value: "whole" },
  { beats: 2, label: "1/2", value: "half" },
  { beats: 1.5, label: "1/4 dotted", value: "quarter-dotted" },
  { beats: 1, label: "1/4", value: "quarter" },
  { beats: 2 / 3, label: "1/4 triplet", value: "quarter-triplet" },
  { beats: 0.75, label: "1/8 dotted", value: "eighth-dotted" },
  { beats: 0.5, label: "1/8", value: "eighth" },
  { beats: 0.375, label: "1/16 dotted", value: "sixteenth-dotted" },
  { beats: 1 / 3, label: "1/8 triplet", value: "eighth-triplet" },
  { beats: 0.25, label: "1/16", value: "sixteenth" },
  { beats: 1 / 6, label: "1/16 triplet", value: "sixteenth-triplet" },
  { beats: 0.125, label: "1/32", value: "thirty-second" },
] as const;

export type LowPassLfoTiming =
  (typeof LOW_PASS_LFO_TIMINGS)[number]["value"];

export const DEFAULT_LOW_PASS_LFO: LowPassLfoSettings = {
  depth: 0,
  rate: 0.5,
  tempoBpm: 120,
  timing: "free",
};

function clamp(value: number, minimum: number, maximum: number) {
  const finiteValue = Number.isFinite(value) ? value : minimum;
  return Math.min(maximum, Math.max(minimum, finiteValue));
}

export function clampLowPassLfo(key: LowPassLfoKey, value: number) {
  if (key === "depth") return clamp(value, 0, 1);
  if (key === "tempoBpm") {
    return Math.round(
      clamp(value, LOW_PASS_LFO_TEMPO_MIN, LOW_PASS_LFO_TEMPO_MAX),
    );
  }
  return clamp(value, LOW_PASS_LFO_RATE_MIN, LOW_PASS_LFO_RATE_MAX);
}

export function isLowPassLfoTiming(value: string): value is LowPassLfoTiming {
  return LOW_PASS_LFO_TIMINGS.some((timing) => timing.value === value);
}

export function lowPassLfoDepthHz(cutoff: number, depth: number) {
  const center = clampControl("cutoff", cutoff);
  const maximumDepth = Math.min(
    CONTROL_SPECS.cutoff.max,
    Math.max(0, center - LOW_PASS_LFO_MINIMUM_FREQUENCY),
  );
  return maximumDepth * clampLowPassLfo("depth", depth);
}

export function lowPassLfoRateToPosition(rate: number) {
  const clampedRate = clampLowPassLfo("rate", rate);
  return (
    Math.log(clampedRate / LOW_PASS_LFO_RATE_MIN) /
    Math.log(LOW_PASS_LFO_RATE_MAX / LOW_PASS_LFO_RATE_MIN)
  );
}

export function positionToLowPassLfoRate(position: number) {
  const clampedPosition = clamp(position, 0, 1);
  return (
    LOW_PASS_LFO_RATE_MIN *
    Math.pow(
      LOW_PASS_LFO_RATE_MAX / LOW_PASS_LFO_RATE_MIN,
      clampedPosition,
    )
  );
}

export function lowPassLfoTempoToPosition(tempoBpm: number) {
  const clampedTempo = clampLowPassLfo("tempoBpm", tempoBpm);
  return (
    (clampedTempo - LOW_PASS_LFO_TEMPO_MIN) /
    (LOW_PASS_LFO_TEMPO_MAX - LOW_PASS_LFO_TEMPO_MIN)
  );
}

export function positionToLowPassLfoTempo(position: number) {
  return clampLowPassLfo(
    "tempoBpm",
    LOW_PASS_LFO_TEMPO_MIN +
      clamp(position, 0, 1) *
        (LOW_PASS_LFO_TEMPO_MAX - LOW_PASS_LFO_TEMPO_MIN),
  );
}

export function lowPassLfoRateHz(settings: LowPassLfoSettings) {
  if (settings.timing === "free") {
    return clampLowPassLfo("rate", settings.rate);
  }

  const timing = LOW_PASS_LFO_TIMINGS.find(
    (candidate) => candidate.value === settings.timing,
  );
  if (!timing?.beats) return clampLowPassLfo("rate", settings.rate);

  const beatsPerSecond =
    clampLowPassLfo("tempoBpm", settings.tempoBpm) / 60;
  return beatsPerSecond / timing.beats;
}
