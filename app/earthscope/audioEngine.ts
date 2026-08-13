import { EARTHSCOPE_WINDOW_SECONDS } from "../lib/earthScopeConfig";
import { browserBufferRate } from "./audioMath";
import {
  effectiveLoopSampleCount,
  type VoiceControls,
} from "./controls";
import {
  DEFAULT_LOW_PASS_LFO,
  lowPassLfoDepthHz,
  lowPassLfoRateHz,
  type LowPassLfoSettings,
} from "./lowPassLfo";
import { prepareLoop, recent } from "./signal";
import { DEFAULT_TEMPO } from "./tempo";
import {
  DEFAULT_SEQUENCE,
  sequenceHasNotes,
  sequencePositionAtTime,
  sequenceRateAtStep,
  sequenceStepDurationSeconds,
  type MelodicSequence,
  type SequencerTransport,
} from "./sequencer";
import {
  setAudioContextOutput,
  type AudioOutputChannel,
} from "./audioOutput";
import { sourceGateOpen } from "./voiceGate";

export interface SignalSource {
  sampleRate: number;
  samples: number[];
}

export interface SeismicAudioEngine {
  measure: () => number;
  setOutputDevice: (deviceId: string) => Promise<void>;
  setOutputChannel: (channel: AudioOutputChannel) => void;
  setGateOpen: (open: boolean) => void;
  setPitchBendRatio: (ratio: number) => void;
  setRepeatsPerSecond: (value: number) => void;
  setSequence: (
    sequence: MelodicSequence,
    transport: SequencerTransport,
  ) => void;
  stop: () => Promise<void>;
}

const SEQUENCE_LOOKAHEAD_SECONDS = 240;
const SEQUENCE_REFILL_MARGIN_SECONDS = 60;

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
  getTempoBpm: () => number = () => DEFAULT_TEMPO,
  initialSequence: MelodicSequence = DEFAULT_SEQUENCE,
  initialSequenceTransport: SequencerTransport = {
    running: false,
    startedAtMs: null,
  },
  outputDeviceId = "",
  outputChannel: AudioOutputChannel = "stereo",
): Promise<SeismicAudioEngine> {
  requestPlaybackAudioSession();
  const context = new AudioContext({ latencyHint: "interactive" });
  try {
    await setAudioContextOutput(context, outputDeviceId);
  } catch (outputError) {
    await context.close();
    throw outputError;
  }
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
  const sequenceGate = context.createGain();
  const master = context.createGain();
  const outputPanner = context.createStereoPanner();
  const repeatRateSignal = context.createConstantSource();
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
  filterLfo.frequency.value = lowPassLfoRateHz(
    lowPassLfo,
    getTempoBpm(),
  );
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
  sequenceGate.gain.value = 1;
  master.gain.value = controls.volume;
  repeatRateSignal.offset.value = controls.repeatsPerSecond;
  repeatRateSignal.start();
  filter
    .connect(drive)
    .connect(compressor)
    .connect(gate)
    .connect(sequenceGate)
    .connect(master)
    .connect(analyser);
  outputPanner.connect(context.destination);

  const setOutputChannel = (channel: AudioOutputChannel) => {
    analyser.disconnect();
    if (channel === "stereo") {
      analyser.connect(context.destination);
      return;
    }

    outputPanner.pan.setValueAtTime(
      channel === "left" ? -1 : 1,
      context.currentTime,
    );
    analyser.connect(outputPanner);
  };
  setOutputChannel(outputChannel);

  let activeBuffer = makeLoopBuffer(context, initialValues, current.sampleRate);
  let activeSource = context.createBufferSource();
  let activeGain = context.createGain();
  let activeRateScale = context.createGain();
  let activeSignalSamples = current.samples;
  let activeSampleRate = current.sampleRate;
  let activeSampleCount = initialValues.length;
  let manualRepeatRate = controls.repeatsPerSecond;
  let sequence = initialSequence;
  let sequenceTransport = initialSequenceTransport;
  let sequenceStartAt = context.currentTime;
  let sequenceScheduledUntil = 0;
  let scheduledTempoBpm = getTempoBpm();
  let activeRepeats = controls.repeatsPerSecond;
  let pitchBendRatio = 1;
  let phase = 0;
  let phaseUpdatedAt = context.currentTime;

  const effectiveRepeatRate = (repeatsPerSecond: number) =>
    repeatsPerSecond * pitchBendRatio;

  const sequenceIsRunning = () =>
    sequence.enabled &&
    sequenceTransport.running &&
    sequenceHasNotes(sequence);

  const connectRepeatRate = (
    source: AudioBufferSourceNode,
    buffer: AudioBuffer,
    rateScale: GainNode,
  ) => {
    source.playbackRate.value = 0;
    rateScale.gain.value = buffer.duration * pitchBendRatio;
    repeatRateSignal.connect(rateScale);
    rateScale.connect(source.playbackRate);
  };

  const currentSequenceStep = (now = context.currentTime) =>
    sequenceIsRunning()
      ? sequencePositionAtTime({
          length: sequence.length,
          now,
          startAt: sequenceStartAt,
          tempoBpm: scheduledTempoBpm,
        }).step
      : null;

  const repeatRateAt = (now: number) => {
    if (!sequenceIsRunning()) {
      return effectiveRepeatRate(manualRepeatRate);
    }
    const step = currentSequenceStep(now) ?? 0;
    return effectiveRepeatRate(
      sequenceRateAtStep(sequence, step, manualRepeatRate),
    );
  };

  const updatePhase = (now: number) => {
    phase = (phase + (now - phaseUpdatedAt) * activeRepeats) % 1;
    phaseUpdatedAt = now;
    activeRepeats = repeatRateAt(now);
  };

  const scheduleSequence = (
    nextSequence: MelodicSequence,
    nextTempoBpm: number,
    nextTransport: SequencerTransport,
    now = context.currentTime,
  ) => {
    const wasEnabled = sequenceIsRunning();
    const sameTransport =
      wasEnabled &&
      nextTransport.running &&
      nextTransport.startedAtMs === sequenceTransport.startedAtMs;
    const previousPosition = wasEnabled
      ? sequencePositionAtTime({
          length: sequence.length,
          now,
          startAt: sequenceStartAt,
          tempoBpm: scheduledTempoBpm,
        })
      : { progress: 0, step: 0 };

    sequence = nextSequence;
    sequenceTransport = nextTransport;
    scheduledTempoBpm = nextTempoBpm;
    repeatRateSignal.offset.cancelScheduledValues(now);
    gate.gain.cancelScheduledValues(now);
    sequenceGate.gain.cancelScheduledValues(now);
    const sequencerRunning = sequenceIsRunning();
    gate.gain.setTargetAtTime(
      sourceGateOpen(gateOpen, sequencerRunning) ? 1 : 0,
      now,
      0.006,
    );

    if (!sequencerRunning) {
      sequenceStartAt = now;
      sequenceScheduledUntil = 0;
      repeatRateSignal.offset.setValueAtTime(manualRepeatRate, now);
      sequenceGate.gain.setTargetAtTime(1, now, 0.006);
      activeRepeats = effectiveRepeatRate(manualRepeatRate);
      return;
    }

    const stepDuration = sequenceStepDurationSeconds(scheduledTempoBpm);
    const preservedStep = previousPosition.step % sequence.length;
    sequenceStartAt = sameTransport
      ? now - (preservedStep + previousPosition.progress) * stepDuration
      : nextTransport.startedAtMs === null
        ? now
        : now + (nextTransport.startedAtMs - performance.now()) / 1000;

    const position = sequencePositionAtTime({
      length: sequence.length,
      now,
      startAt: sequenceStartAt,
      tempoBpm: scheduledTempoBpm,
    });
    const currentNote = sequence.notes[position.step] ?? null;
    repeatRateSignal.offset.setValueAtTime(
      sequenceRateAtStep(sequence, position.step, manualRepeatRate),
      now,
    );
    sequenceGate.gain.setTargetAtTime(currentNote === null ? 0 : 1, now, 0.006);

    let step = (position.step + 1) % sequence.length;
    let stepAt = now + (1 - position.progress) * stepDuration;
    const scheduleUntil = now + SEQUENCE_LOOKAHEAD_SECONDS;
    while (stepAt < scheduleUntil) {
      const note = sequence.notes[step] ?? null;
      if (note !== null) {
        repeatRateSignal.offset.setValueAtTime(
          sequenceRateAtStep(sequence, step, manualRepeatRate),
          stepAt,
        );
      }
      sequenceGate.gain.setTargetAtTime(note === null ? 0 : 1, stepAt, 0.006);
      step = (step + 1) % sequence.length;
      stepAt += stepDuration;
    }
    sequenceScheduledUntil = stepAt;
    activeRepeats = repeatRateAt(now);
  };

  activeSource.loop = true;
  activeSource.buffer = activeBuffer;
  connectRepeatRate(activeSource, activeBuffer, activeRateScale);
  activeSource.connect(activeGain).connect(filter);
  activeSource.start();
  scheduleSequence(sequence, scheduledTempoBpm, sequenceTransport);

  const setActiveRepeatRate = (
    repeatsPerSecond: number,
    now = context.currentTime,
    smooth = true,
  ) => {
    updatePhase(now);
    manualRepeatRate = Number.isFinite(repeatsPerSecond)
      ? Math.max(0.000001, repeatsPerSecond)
      : manualRepeatRate;
    if (sequenceIsRunning()) return;
    activeRepeats = effectiveRepeatRate(manualRepeatRate);
    repeatRateSignal.offset.cancelScheduledValues(now);
    if (smooth) {
      repeatRateSignal.offset.setTargetAtTime(manualRepeatRate, now, 0.01);
    } else {
      repeatRateSignal.offset.setValueAtTime(manualRepeatRate, now);
    }
  };

  const updateTimer = window.setInterval(() => {
    const nextControls = getControls();
    const nextLowPassLfo = getLowPassLfo();
    const latest = getSignal();
    const now = context.currentTime;
    if (sequenceIsRunning()) {
      updatePhase(now);
    } else {
      setActiveRepeatRate(nextControls.repeatsPerSecond, now);
    }

    const nextTempoBpm = getTempoBpm();
    if (nextTempoBpm !== scheduledTempoBpm) {
      scheduleSequence(sequence, nextTempoBpm, sequenceTransport, now);
    } else if (
      sequenceIsRunning() &&
      sequenceScheduledUntil - now < SEQUENCE_REFILL_MARGIN_SECONDS
    ) {
      scheduleSequence(sequence, scheduledTempoBpm, sequenceTransport, now);
    }

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
      const nextRateScale = context.createGain();
      nextSource.loop = true;
      nextSource.buffer = nextBuffer;
      connectRepeatRate(nextSource, nextBuffer, nextRateScale);
      nextGain.gain.setValueAtTime(0, now);
      nextGain.gain.linearRampToValueAtTime(1, now + 0.03);
      nextSource.connect(nextGain).connect(filter);
      nextSource.start(now, phase * nextBuffer.duration);

      activeGain.gain.setValueAtTime(activeGain.gain.value, now);
      activeGain.gain.linearRampToValueAtTime(0, now + 0.03);
      const previousRateScale = activeRateScale;
      activeSource.stop(now + 0.04);
      activeSource.onended = () => previousRateScale.disconnect();
      activeBuffer = nextBuffer;
      activeSource = nextSource;
      activeGain = nextGain;
      activeRateScale = nextRateScale;
      activeSignalSamples = latest.samples;
      activeSampleRate = latest.sampleRate;
      activeSampleCount = nextValues.length;
    }

    filter.frequency.setTargetAtTime(nextControls.cutoff, now, 0.01);
    filter.Q.setTargetAtTime(nextControls.resonance, now, 0.01);
    filterLfo.frequency.setTargetAtTime(
      lowPassLfoRateHz(nextLowPassLfo, getTempoBpm()),
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
    setOutputDevice: (deviceId) =>
      setAudioContextOutput(context, deviceId),
    setOutputChannel,
    setGateOpen: (open) => {
      if (open === gateOpen) return;
      gateOpen = open;
      const now = context.currentTime;
      gate.gain.cancelScheduledValues(now);
      gate.gain.setTargetAtTime(
        sourceGateOpen(gateOpen, sequenceIsRunning()) ? 1 : 0,
        now,
        0.006,
      );
    },
    setPitchBendRatio: (ratio) => {
      const now = context.currentTime;
      updatePhase(now);
      pitchBendRatio =
        Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
      activeRateScale.gain.setValueAtTime(
        activeBuffer.duration * pitchBendRatio,
        now,
      );
      activeRepeats = repeatRateAt(now);
    },
    setRepeatsPerSecond: (value) => {
      setActiveRepeatRate(value, context.currentTime, false);
    },
    setSequence: (nextSequence, nextTransport) => {
      updatePhase(context.currentTime);
      scheduleSequence(nextSequence, getTempoBpm(), nextTransport);
    },
    stop: async () => {
      window.clearInterval(updateTimer);
      repeatRateSignal.stop();
      master.gain.setTargetAtTime(0, context.currentTime, 0.02);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      await context.close();
    },
  };
}
