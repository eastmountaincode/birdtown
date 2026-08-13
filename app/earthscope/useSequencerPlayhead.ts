"use client";

import { useEffect, useRef, useState } from "react";
import {
  sequencePositionAtTime,
  type MelodicSequence,
  type SequencerTransport,
} from "./sequencer";

export function useSequencerPlayhead(
  sequence: MelodicSequence,
  transport: SequencerTransport,
  tempoBpm: number,
  onStepChange: (step: number) => void,
) {
  const [step, setStep] = useState<number | null>(null);
  const stepRef = useRef<number | null>(null);
  const onStepChangeRef = useRef(onStepChange);

  useEffect(() => {
    onStepChangeRef.current = onStepChange;
  }, [onStepChange]);

  useEffect(() => {
    const startedAtMs = transport.startedAtMs;
    if (!transport.running || startedAtMs === null) {
      stepRef.current = null;
      return;
    }

    let frame = 0;
    const update = () => {
      const nextStep = sequencePositionAtTime({
        length: sequence.length,
        now: performance.now() / 1_000,
        startAt: startedAtMs / 1_000,
        tempoBpm,
      }).step;
      if (stepRef.current !== nextStep) {
        stepRef.current = nextStep;
        setStep(nextStep);
        onStepChangeRef.current(nextStep);
      }
      frame = window.requestAnimationFrame(update);
    };

    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [sequence.length, tempoBpm, transport.running, transport.startedAtMs]);

  return transport.running ? step : null;
}
