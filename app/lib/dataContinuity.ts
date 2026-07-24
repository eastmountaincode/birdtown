interface TimedMergeOptions {
  endMillis: number;
  existing: number[];
  incoming: number[];
  lastEndMillis: number | null;
  lastSampleRate: number;
  maxSamples: number;
  sampleRate: number;
  startMillis: number;
}

export function mergeTimedSamples(options: TimedMergeOptions) {
  const period = 1000 / options.sampleRate;
  let incoming = options.incoming;
  let existing = options.existing;
  if (
    options.lastEndMillis !== null &&
    options.lastSampleRate === options.sampleRate
  ) {
    const expectedStart = options.lastEndMillis + period;
    const offset = Math.round((expectedStart - options.startMillis) / period);
    if (offset > 0) incoming = incoming.slice(offset);
    if (offset < -1) existing = [];
  } else if (options.lastEndMillis !== null) {
    existing = [];
  }
  if (incoming.length === 0) {
    return {
      accepted: false,
      lastEndMillis: options.lastEndMillis,
      samples: existing,
    };
  }
  return {
    accepted: true,
    lastEndMillis: options.endMillis,
    samples: existing.concat(incoming).slice(-options.maxSamples),
  };
}
