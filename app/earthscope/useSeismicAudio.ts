"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startSeismicAudio, type SeismicAudioEngine } from "./audioEngine";
import type { AudioOutputChannel } from "./audioOutput";
import type { VoiceControls } from "./controls";
import type { LowPassLfoSettings } from "./lowPassLfo";
import type { MelodicSequence, SequencerTransport } from "./sequencer";

export function useSeismicAudio({
  controls,
  gateOpen,
  lowPassLfo,
  sampleRate,
  samples,
  sequence,
  sequenceTransport,
  tempoBpm,
}: {
  controls: VoiceControls;
  gateOpen: boolean;
  lowPassLfo: LowPassLfoSettings;
  sampleRate: number;
  samples: number[];
  sequence: MelodicSequence;
  sequenceTransport: SequencerTransport;
  tempoBpm: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sequenceStep, setSequenceStep] = useState<number | null>(null);
  const audioRef = useRef<SeismicAudioEngine | null>(null);
  const controlsRef = useRef(controls);
  const gateOpenRef = useRef(gateOpen);
  const lowPassLfoRef = useRef(lowPassLfo);
  const meterTimerRef = useRef(0);
  const outputDeviceIdRef = useRef("");
  const outputChannelRef = useRef<AudioOutputChannel>("stereo");
  const pitchBendRatioRef = useRef(1);
  const rateRef = useRef(sampleRate);
  const runRef = useRef(0);
  const samplesRef = useRef(samples);
  const sequenceRef = useRef(sequence);
  const sequenceTransportRef = useRef(sequenceTransport);
  const sequenceTimerRef = useRef(0);
  const startingRef = useRef(false);
  const tempoBpmRef = useRef(tempoBpm);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    lowPassLfoRef.current = lowPassLfo;
  }, [lowPassLfo]);

  useEffect(() => {
    tempoBpmRef.current = tempoBpm;
  }, [tempoBpm]);

  useEffect(() => {
    sequenceRef.current = sequence;
    sequenceTransportRef.current = sequenceTransport;
    audioRef.current?.setSequence(sequence, sequenceTransport);
  }, [sequence, sequenceTransport]);

  const setGateOpen = useCallback((open: boolean) => {
    gateOpenRef.current = open;
    audioRef.current?.setGateOpen(open);
  }, []);

  useEffect(() => {
    setGateOpen(gateOpen);
  }, [gateOpen, setGateOpen]);

  useEffect(() => {
    rateRef.current = sampleRate;
    samplesRef.current = samples;
  }, [sampleRate, samples]);

  const stop = useCallback(async () => {
    runRef.current += 1;
    startingRef.current = false;
    const audio = audioRef.current;
    audioRef.current = null;
    window.clearInterval(meterTimerRef.current);
    window.clearInterval(sequenceTimerRef.current);
    setLevel(0);
    setPlaying(false);
    setSequenceStep(null);
    await audio?.stop();
  }, []);

  const canPlay = sampleRate > 0 && samples.length >= sampleRate * 2;

  const setRepeatsPerSecond = useCallback((value: number) => {
    controlsRef.current = {
      ...controlsRef.current,
      repeatsPerSecond: value,
    };
    audioRef.current?.setRepeatsPerSecond(value);
  }, []);

  const setPitchBendRatio = useCallback((ratio: number) => {
    const nextRatio =
      Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    pitchBendRatioRef.current = nextRatio;
    audioRef.current?.setPitchBendRatio(nextRatio);
  }, []);

  const setOutputDevice = useCallback(async (deviceId: string) => {
    const audio = audioRef.current;
    if (audio) await audio.setOutputDevice(deviceId);
    outputDeviceIdRef.current = deviceId;
  }, []);

  const setOutputChannel = useCallback((channel: AudioOutputChannel) => {
    outputChannelRef.current = channel;
    audioRef.current?.setOutputChannel(channel);
  }, []);

  const togglePlayback = useCallback(async () => {
    if (playing) {
      await stop();
      return;
    }
    if (!canPlay || startingRef.current) return;

    const run = ++runRef.current;
    startingRef.current = true;
    setError(null);

    try {
      const audio = await startSeismicAudio(
        () => ({ sampleRate: rateRef.current, samples: samplesRef.current }),
        () => controlsRef.current,
        () => gateOpenRef.current,
        () => lowPassLfoRef.current,
        () => tempoBpmRef.current,
        sequenceRef.current,
        sequenceTransportRef.current,
        outputDeviceIdRef.current,
        outputChannelRef.current,
      );
      if (run !== runRef.current) {
        await audio.stop();
        return;
      }
      audioRef.current = audio;
      audio.setGateOpen(gateOpenRef.current);
      audio.setPitchBendRatio(pitchBendRatioRef.current);
      setPlaying(true);
      meterTimerRef.current = window.setInterval(() => {
        const decibels = 20 * Math.log10(Math.max(audio.measure(), 0.000001));
        setLevel(Math.max(0, Math.min(1, (decibels + 60) / 54)));
      }, 200);
      sequenceTimerRef.current = window.setInterval(() => {
        setSequenceStep(audio.currentSequenceStep());
      }, 50);
    } catch (startError) {
      if (run === runRef.current) {
        setPlaying(false);
        setError(
          startError instanceof Error ? startError.message : "Audio could not start",
        );
      }
    } finally {
      if (run === runRef.current) startingRef.current = false;
    }
  }, [canPlay, playing, stop]);

  useEffect(
    () => () => {
      runRef.current += 1;
      startingRef.current = false;
      window.clearInterval(meterTimerRef.current);
      window.clearInterval(sequenceTimerRef.current);
      void audioRef.current?.stop();
    },
    [],
  );

  return {
    canPlay,
    error,
    level,
    playing,
    sequenceStep,
    setGateOpen,
    setOutputDevice,
    setOutputChannel,
    setPitchBendRatio,
    setRepeatsPerSecond,
    togglePlayback,
  };
}
