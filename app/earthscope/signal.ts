export function recent(samples: number[], sampleRate: number, seconds = 30) {
  return samples.slice(-Math.max(2, Math.round(sampleRate * seconds)));
}

export function centerAndScale(samples: number[]) {
  if (samples.length === 0) return new Float32Array();
  let mean = 0;
  for (const value of samples) mean += value;
  mean /= samples.length;
  let peak = 1;
  for (const value of samples) peak = Math.max(peak, Math.abs(value - mean));
  const output = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    output[index] = (samples[index] - mean) / peak;
  }
  return output;
}

export function prepareLoop(samples: number[]) {
  const centered = centerAndScale(samples);
  if (centered.length < 2) return centered;
  const start = centered[0];
  const difference = centered.at(-1)! - start;
  let peak = Number.EPSILON;
  for (let index = 0; index < centered.length; index += 1) {
    const baseline = start + difference * (index / (centered.length - 1));
    centered[index] -= baseline;
    peak = Math.max(peak, Math.abs(centered[index]));
  }
  for (let index = 0; index < centered.length; index += 1) centered[index] /= peak;
  return centered;
}
