import { EARTHSCOPE_WINDOW_SECONDS } from "../lib/earthScopeConfig";
import { browserBufferRate, playbackRateForRepeats } from "./audioMath";
import {
  effectiveLoopSampleCount,
  type VoiceControls,
} from "./controls";
import {
  clampLowPassLfo,
  DEFAULT_LOW_PASS_LFO,
  lowPassLfoDepthHz,
  type LowPassLfoSettings,
} from "./lowPassLfo";
import { prepareLoop, recent } from "./signal";

export interface SignalSource {
  sampleRate: number;
  samples: number[];
}

export interface SeismicAudioEngine {
  measure: () => number;
  setGateOpen: (open: boolean) => void;
  setPitchBendRatio: (ratio: number) => void;
  setRepeatsPerSecond: (value: number) => void;
  stop: () => Promise<void>;
}

type NavigatorWithAudioSession = Navigator & {
  audioSession?: {
    type: string;
  };
};

function requestPlaybackAudioSession() {
  try {
    const audioSession = (navigator as NavigatorWithAudioSession).audioSession;
    if (audioSession) audioSession.type = "playback";
  } catch {
    // AudioSession is experimental. AudioContext.resume() remains the fallback.
  }
}

function makeLoopBuffer(
  context: AudioContext,
  values: number[],
  sourceRate: number,
) {
  const normalized = prepareLoop(values);
  const buffer = context.createBuffer(
    1,
    normalized.length,
    browserBufferRate(sourceRate),
  );
  buffer.copyToChannel(normalized, 0);
  return buffer;
}

function loopValues(signal: SignalSource, requestedSampleCount: number) {
  const values = recent(
    signal.samples,
    signal.sampleRate,
    EARTHSCOPE_WINDOW_SECONDS,
  );
  const sampleCount = effectiveLoopSampleCount(
    requestedSampleCount,
    values.length,
  );
  return values.slice(-sampleCount);
}

export async function startSeismicAudio(
  getSignal: () => SignalSource,
  getControls: () => VoiceControls,
  getGateOpen: () => boolean = () => true,
  getLowPassLfo: () => LowPassLfoSettings = () => DEFAULT_LOW_PASS_LFO,
): Promise<SeismicAudioEngine> {
  requestPlaybackAudioSession();
  const context = new AudioContext({ latencyHint: "interactive" });
  try {
    await context.resume();
  } catch {
    await context.close();
    throw new Error("Sound is blocked. Tap Play again.");
  }
  if (context.state !== "running") {
    await context.close();
    throw new Error("Sound is blocked. Tap Play again.");
  }

  const controls = getControls();
  const current = getSignal();
  const initialValues = loopValues(current, controls.sampleCount);
  if (initialValues.length < 2) {
    await context.close();
    throw new Error("Not enough seismic samples");
  }

  const analyser = context.createAnalyser();
  const compressor = context.createDynamicsCompressor();
  const drive = context.createGain();
  const filter = context.createBiquadFilter();
  const filterLfo = context.createOscillator();
  const filterLfoDepth = context.createGain();
  const gate = context.createGain();
  const master = context.createGain();
  const lowPassLfo = getLowPassLfo();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.72;
  compressor.threshold.value = -12;
  compressor.knee.value = 8;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  filter.type = "lowpass";
  filter.frequency.value = controls.cutoff;
  filter.Q.value = controls.resonance;
  filterLfo.type = "sine";
  filterLfo.frequency.value = clampLowPassLfo("rate", lowPassLfo.rate);
  filterLfoDepth.gain.value = lowPassLfoDepthHz(
    controls.cutoff,
    lowPassLfo.depth,
  );
  filterLfo.connect(filterLfoDepth);
  filterLfoDepth.connect(filter.frequency);
  filterLfo.start();
  drive.gain.value = 0.9;
  let gateOpen = getGateOpen();
  gate.gain.value = gateOpen ? 1 : 0;
  master.gain.value = controls.volume;
  filter
    .connect(drive)
    .connect(compressor)
    .connect(gate)
    .connect(master)
    .connect(analyser)
    .connect(context.destination);

  let activeBuffer = makeLoopBuffer(context, initialValues, current.sampleRate);
  let activeSource = context.createBufferSource();
  let activeGain = context.createGain();
  let activeSignalSamples = current.samples;
  let activeSampleRate = current.sampleRate;
  let activeSampleCount = initialValues.length;
  let activeRepeats = controls.repeatsPerSecond;
  let pitchBendRatio = 1;
  let phase = 0;
  let phaseUpdatedAt = context.currentTime;

  const effectiveRepeatRate = (repeatsPerSecond: number) =>
    repeatsPerSecond * pitchBendRatio;

  activeSource.loop = true;
  activeSource.buffer = activeBuffer;
  activeSource.playbackRate.value = playbackRateForRepeats(
    activeBuffer.duration,
    controls.repeatsPerSecond,
  );
  activeSource.connect(activeGain).connect(filter);
  activeSource.start();

  const setActiveRepeatRate = (
    repeatsPerSecond: number,
    now = context.currentTime,
    smooth = true,
  ) => {
    phase = (phase + (now - phaseUpdatedAt) * activeRepeats) % 1;
    phaseUpdatedAt = now;
    activeRepeats = Number.isFinite(repeatsPerSecond)
      ? Math.max(0.000001, repeatsPerSecond)
      : activeRepeats;
    activeSource.playbackRate.cancelScheduledValues(now);
    const playbackRate = playbackRateForRepeats(
      activeBuffer.duration,
      activeRepeats,
    );
    if (smooth) {
      activeSource.playbackRate.setTargetAtTime(playbackRate, now, 0.01);
    } else {
      activeSource.playbackRate.setValueAtTime(playbackRate, now);
    }
  };

  const updateTimer = window.setInterval(() => {
    const nextControls = getControls();
    const nextLowPassLfo = getLowPassLfo();
    const latest = getSignal();
    const now = context.currentTime;
    setActiveRepeatRate(
      effectiveRepeatRate(nextControls.repeatsPerSecond),
      now,
    );

    const nextValues = loopValues(latest, nextControls.sampleCount);
    if (
      nextValues.length >= 2 &&
      (nextValues.length !== activeSampleCount ||
        latest.samples !== activeSignalSamples ||
        latest.sampleRate !== activeSampleRate)
    ) {
      const nextBuffer = makeLoopBuffer(context, nextValues, latest.sampleRate);
      const nextSource = context.createBufferSource();
      const nextGain = context.createGain();
      nextSource.loop = true;
      nextSource.buffer = nextBuffer;
      nextSource.playbackRate.value = playbackRateForRepeats(
        nextBuffer.duration,
        effectiveRepeatRate(nextControls.repeatsPerSecond),
      );
      nextGain.gain.setValueAtTime(0, now);
      nextGain.gain.linearRampToValueAtTime(1, now + 0.03);
      nextSource.connect(nextGain).connect(filter);
      nextSource.start(now, phase * nextBuffer.duration);

      activeGain.gain.setValueAtTime(activeGain.gain.value, now);
      activeGain.gain.linearRampToValueAtTime(0, now + 0.03);
      activeSource.stop(now + 0.04);
      activeBuffer = nextBuffer;
      activeSource = nextSource;
      activeGain = nextGain;
      activeSignalSamples = latest.samples;
      activeSampleRate = latest.sampleRate;
      activeSampleCount = nextValues.length;
    }

    filter.frequency.setTargetAtTime(nextControls.cutoff, now, 0.01);
    filter.Q.setTargetAtTime(nextControls.resonance, now, 0.01);
    filterLfo.frequency.setTargetAtTime(
      clampLowPassLfo("rate", nextLowPassLfo.rate),
      now,
      0.01,
    );
    filterLfoDepth.gain.setTargetAtTime(
      lowPassLfoDepthHz(nextControls.cutoff, nextLowPassLfo.depth),
      now,
      0.01,
    );
    master.gain.setTargetAtTime(nextControls.volume, now, 0.01);
  }, 50);

  const outputWaveform = new Float32Array(analyser.fftSize);

  return {
    measure: () => {
      analyser.getFloatTimeDomainData(outputWaveform);
      let energy = 0;
      for (const value of outputWaveform) energy += value * value;
      return Math.sqrt(energy / outputWaveform.length);
    },
    setGateOpen: (open) => {
      if (open === gateOpen) return;
      gateOpen = open;
      const now = context.currentTime;
      gate.gain.cancelScheduledValues(now);
      gate.gain.setTargetAtTime(open ? 1 : 0, now, 0.006);
    },
    setPitchBendRatio: (ratio) => {
      pitchBendRatio =
        Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
      setActiveRepeatRate(
        effectiveRepeatRate(getControls().repeatsPerSecond),
        context.currentTime,
        false,
      );
    },
    setRepeatsPerSecond: (value) => {
      setActiveRepeatRate(
        effectiveRepeatRate(value),
        context.currentTime,
        false,
      );
    },
    stop: async () => {
      window.clearInterval(updateTimer);
      master.gain.setTargetAtTime(0, context.currentTime, 0.02);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      await context.close();
    },
  };
}
