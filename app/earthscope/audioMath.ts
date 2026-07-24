export function browserBufferRate(sourceRate: number) {
  return Math.max(3000, sourceRate);
}

export function playbackRateForRepeats(
  bufferDuration: number,
  repeatsPerSecond: number,
) {
  return Math.max(0.000001, bufferDuration * repeatsPerSecond);
}
