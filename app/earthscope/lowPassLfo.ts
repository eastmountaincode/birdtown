import { clampControl, CONTROL_SPECS } from "./controls";

export interface LowPassLfoSettings {
  depth: number;
  rate: number;
}

export type LowPassLfoKey = keyof LowPassLfoSettings;

export const LOW_PASS_LFO_RATE_MIN = 0.01;
export const LOW_PASS_LFO_RATE_MAX = 20;
export const LOW_PASS_LFO_MINIMUM_FREQUENCY = 20;

export const DEFAULT_LOW_PASS_LFO: LowPassLfoSettings = {
  depth: 0,
  rate: 0.5,
};

function clamp(value: number, minimum: number, maximum: number) {
  const finiteValue = Number.isFinite(value) ? value : minimum;
  return Math.min(maximum, Math.max(minimum, finiteValue));
}

export function clampLowPassLfo(key: LowPassLfoKey, value: number) {
  return key === "depth"
    ? clamp(value, 0, 1)
    : clamp(value, LOW_PASS_LFO_RATE_MIN, LOW_PASS_LFO_RATE_MAX);
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
