import { CONTROL_SPECS } from "./controls";

const { max: maximumSampleCount, min: minimumSampleCount } =
  CONTROL_SPECS.sampleCount;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function sampleCountToPosition(sampleCount: number) {
  const safeSampleCount = Number.isFinite(sampleCount)
    ? sampleCount
    : minimumSampleCount;
  const clampedSampleCount = clamp(
    safeSampleCount,
    minimumSampleCount,
    maximumSampleCount,
  );

  return (
    Math.log(clampedSampleCount / minimumSampleCount) /
    Math.log(maximumSampleCount / minimumSampleCount)
  );
}

export function positionToSampleCount(position: number) {
  const safePosition = Number.isFinite(position) ? position : 0;
  const clampedPosition = clamp(safePosition, 0, 1);

  return Math.round(
    minimumSampleCount *
      Math.pow(maximumSampleCount / minimumSampleCount, clampedPosition),
  );
}
