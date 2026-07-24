"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startSeismicAudio, type SeismicAudioEngine } from "./audioEngine";
import type { VoiceControls } from "./controls";

export function useSeismicAudio({
  controls,
  gateOpen,
  sampleRate,
  samples,
}: {
  controls: VoiceControls;
  gateOpen: boolean;
  sampleRate: number;
  samples: number[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<SeismicAudioEngine | null>(null);
  const controlsRef = useRef(controls);
  const gateOpenRef = useRef(gateOpen);
  const meterTimerRef = useRef(0);
  const rateRef = useRef(sampleRate);
  const runRef = useRef(0);
  const samplesRef = useRef(samples);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

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
    const audio = audioRef.current;
    audioRef.current = null;
    window.clearInterval(meterTimerRef.current);
    setLevel(0);
    setPlaying(false);
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

  const togglePlayback = useCallback(async () => {
    if (playing) {
      await stop();
      return;
    }
    if (!canPlay) return;

    const run = ++runRef.current;
    setError(null);
    setPlaying(true);

    try {
      const audio = await startSeismicAudio(
        () => ({ sampleRate: rateRef.current, samples: samplesRef.current }),
        () => controlsRef.current,
        () => gateOpenRef.current,
      );
      if (run !== runRef.current) {
        await audio.stop();
        return;
      }
      audioRef.current = audio;
      audio.setGateOpen(gateOpenRef.current);
      meterTimerRef.current = window.setInterval(() => {
        const decibels = 20 * Math.log10(Math.max(audio.measure(), 0.000001));
        setLevel(Math.max(0, Math.min(1, (decibels + 60) / 54)));
      }, 200);
    } catch (startError) {
      if (run === runRef.current) {
        setPlaying(false);
        setError(
          startError instanceof Error ? startError.message : "Audio could not start",
        );
      }
    }
  }, [canPlay, playing, stop]);

  useEffect(
    () => () => {
      runRef.current += 1;
      window.clearInterval(meterTimerRef.current);
      void audioRef.current?.stop();
    },
    [],
  );

  return {
    canPlay,
    error,
    level,
    playing,
    setGateOpen,
    setRepeatsPerSecond,
    togglePlayback,
  };
}
