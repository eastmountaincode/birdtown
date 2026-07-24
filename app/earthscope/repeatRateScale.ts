import { CONTROL_SPECS } from "./controls";

const { max: maximumRate, min: minimumRate } =
  CONTROL_SPECS.repeatsPerSecond;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function repeatRateToPosition(rate: number) {
  const safeRate = Number.isFinite(rate) ? rate : minimumRate;
  const clampedRate = clamp(safeRate, minimumRate, maximumRate);
  return (
    Math.log(clampedRate / minimumRate) /
    Math.log(maximumRate / minimumRate)
  );
}

export function positionToRepeatRate(position: number) {
  const safePosition = Number.isFinite(position) ? position : 0;
  const clampedPosition = clamp(safePosition, 0, 1);
  return (
    minimumRate *
    Math.pow(maximumRate / minimumRate, clampedPosition)
  );
}
