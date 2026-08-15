"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  externalClockTransportStartAt,
  midiClockInputOptions,
  midiClockPulseIntervalMs,
  midiClockTempoFromIntervals,
  midiInputFingerprint,
  midiInputTopology,
  MIDI_CLOCK_PPQN,
  MIDI_CLOCK_PULSES_PER_SIXTEENTH,
  parseMidiRealtimeMessage,
  recommendedMidiClockInput,
  restoreMidiClockInput,
  type MidiClockInputOption,
} from "./midiClock";
import { clampTempo } from "./tempo";

const TEMPO_INTERVAL_COUNT = MIDI_CLOCK_PPQN;
const TEMPO_INTERVAL_MINIMUM = MIDI_CLOCK_PULSES_PER_SIXTEENTH;
const TRANSPORT_REBASE_PULSES = MIDI_CLOCK_PPQN * 4;

export type ExternalClockStatus =
  | "MIDI disconnected"
  | "Input disconnected"
  | "Waiting for Start"
  | "Waiting for clock"
  | "Running"
  | "Stopped"
  | "Clock lost";

interface MidiClockInputState {
  error: string | null;
  inputs: MidiClockInputOption[];
  running: boolean;
  selectedInputId: string | null;
  status: ExternalClockStatus;
}

const INITIAL_STATE: MidiClockInputState = {
  error: null,
  inputs: [],
  running: false,
  selectedInputId: null,
  status: "MIDI disconnected",
};

function clockLossDelayMs(tempoBpm: number) {
  return Math.max(500, midiClockPulseIntervalMs(tempoBpm) * 12);
}

export function useMidiClockInput({
  access,
  enabled,
  onTempoChange,
  onTransportChange,
  onRealtimeMessage,
}: {
  access: MIDIAccess | null;
  enabled: boolean;
  onTempoChange?: (tempoBpm: number | null) => void;
  onTransportChange?: (
    running: boolean,
    startedAtMs: number | null,
  ) => void;
  onRealtimeMessage?: (status: number) => void;
}) {
  const [state, setState] = useState(INITIAL_STATE);
  const clockLostTimerRef = useRef(0);
  const intervalsRef = useRef<number[]>([]);
  const lastPulseAtRef = useRef<number | null>(null);
  const onRealtimeMessageRef = useRef(onRealtimeMessage);
  const onTempoChangeRef = useRef(onTempoChange);
  const onTransportChangeRef = useRef(onTransportChange);
  const pendingStartRef = useRef<"start" | "continue" | null>(null);
  const preferredFingerprintRef = useRef<string | null>(null);
  const pulseCountRef = useRef(0);
  const resumeAfterLossRef = useRef(false);
  const runningRef = useRef(false);
  const selectedInputIdRef = useRef<string | null>(null);
  const tempoBpmRef = useRef<number | null>(null);

  useEffect(() => {
    onRealtimeMessageRef.current = onRealtimeMessage;
  }, [onRealtimeMessage]);

  useEffect(() => {
    onTempoChangeRef.current = onTempoChange;
  }, [onTempoChange]);

  useEffect(() => {
    onTransportChangeRef.current = onTransportChange;
  }, [onTransportChange]);

  const stopClock = useCallback(
    (resumeAfterLoss = false) => {
      window.clearTimeout(clockLostTimerRef.current);
      clockLostTimerRef.current = 0;
      pendingStartRef.current = null;
      resumeAfterLossRef.current = resumeAfterLoss;
      const wasRunning = runningRef.current;
      runningRef.current = false;
      if (wasRunning) onTransportChangeRef.current?.(false, null);
    },
    [],
  );

  const publishStopped = useCallback(
    (status: ExternalClockStatus, resumeAfterLoss = false) => {
      stopClock(resumeAfterLoss);
      setState((current) => ({ ...current, running: false, status }));
    },
    [stopClock],
  );

  const resetTiming = useCallback(() => {
    intervalsRef.current = [];
    lastPulseAtRef.current = null;
    pulseCountRef.current = 0;
    tempoBpmRef.current = null;
    onTempoChangeRef.current?.(null);
  }, []);

  const armStart = useCallback(
    (mode: "start" | "continue" = "start") => {
      window.clearTimeout(clockLostTimerRef.current);
      clockLostTimerRef.current = 0;
      if (mode === "start") pulseCountRef.current = 0;
      pendingStartRef.current = mode;
      resumeAfterLossRef.current = false;
      const wasRunning = runningRef.current;
      runningRef.current = false;
      if (wasRunning) onTransportChangeRef.current?.(false, null);
      setState((current) => ({
        ...current,
        running: false,
        status: "Waiting for clock",
      }));
    },
    [],
  );

  const scheduleClockLoss = useCallback((pulseAtMs: number) => {
    window.clearTimeout(clockLostTimerRef.current);
    const tempo = tempoBpmRef.current;
    const delay = clockLossDelayMs(tempo ?? 120);
    clockLostTimerRef.current = window.setTimeout(() => {
      const lastPulseAt = lastPulseAtRef.current;
      if (
        !runningRef.current ||
        lastPulseAt === null ||
        performance.now() - lastPulseAt < delay
      ) {
        return;
      }
      publishStopped("Clock lost", true);
    }, Math.max(delay, pulseAtMs + delay - performance.now()));
  }, [publishStopped]);

  const handleRealtimeMessage = useCallback(
    (event: MIDIMessageEvent) => {
      if (!event.data) return;
      const message = parseMidiRealtimeMessage(event.data);
      if (!message) return;

      onRealtimeMessageRef.current?.(event.data[0]);

      if (message === "start") {
        lastPulseAtRef.current = null;
        pulseCountRef.current = 0;
        armStart("start");
        return;
      }
      if (message === "continue") {
        lastPulseAtRef.current = null;
        armStart("continue");
        return;
      }
      if (message === "stop") {
        lastPulseAtRef.current = null;
        publishStopped("Stopped");
        return;
      }

      const pulseAt = Number.isFinite(event.timeStamp)
        ? event.timeStamp
        : performance.now();
      const previousPulseAt = lastPulseAtRef.current;
      const currentTempo = tempoBpmRef.current;
      if (previousPulseAt !== null) {
        const interval = pulseAt - previousPulseAt;
        const minimumInterval = midiClockPulseIntervalMs(300) / 2;
        const maximumInterval = midiClockPulseIntervalMs(30) * 2;
        if (interval >= minimumInterval && interval <= maximumInterval) {
          intervalsRef.current = [
            ...intervalsRef.current.slice(-(TEMPO_INTERVAL_COUNT - 1)),
            interval,
          ];
          if (intervalsRef.current.length >= TEMPO_INTERVAL_MINIMUM) {
            const estimatedTempo = midiClockTempoFromIntervals(
              intervalsRef.current,
            );
            if (estimatedTempo !== null) {
              const nextTempo = clampTempo(estimatedTempo);
              if (nextTempo !== tempoBpmRef.current) {
                tempoBpmRef.current = nextTempo;
                onTempoChangeRef.current?.(nextTempo);
              }
            }
          }
        }
      }
      lastPulseAtRef.current = pulseAt;

      if (resumeAfterLossRef.current && pendingStartRef.current === null) {
        const interval = midiClockPulseIntervalMs(currentTempo ?? 120);
        if (previousPulseAt !== null) {
          const elapsedPulses = Math.max(
            1,
            Math.round((pulseAt - previousPulseAt) / interval),
          );
          pulseCountRef.current += elapsedPulses - 1;
        }
        pendingStartRef.current = "continue";
        resumeAfterLossRef.current = false;
      }

      const pendingStart = pendingStartRef.current;
      const tempo = tempoBpmRef.current ?? currentTempo ?? 120;
      if (pendingStart !== null) {
        if (pendingStart === "start") pulseCountRef.current = 0;
        pendingStartRef.current = null;
        runningRef.current = true;
        const startedAtMs = externalClockTransportStartAt({
          pulseAtMs: pulseAt,
          pulseCount: pulseCountRef.current,
          tempoBpm: tempo,
        });
        onTransportChangeRef.current?.(true, startedAtMs);
        setState((current) => ({
          ...current,
          running: true,
          status: "Running",
        }));
      } else if (
        runningRef.current &&
        pulseCountRef.current > 0 &&
        pulseCountRef.current % TRANSPORT_REBASE_PULSES === 0
      ) {
        onTransportChangeRef.current?.(
          true,
          externalClockTransportStartAt({
            pulseAtMs: pulseAt,
            pulseCount: pulseCountRef.current,
            tempoBpm: tempo,
          }),
        );
      }

      if (runningRef.current) {
        pulseCountRef.current += 1;
        scheduleClockLoss(pulseAt);
      }
    },
    [armStart, publishStopped, scheduleClockLoss],
  );

  useEffect(() => {
    if (!access) {
      selectedInputIdRef.current = null;
      resetTiming();
      stopClock();
      const timer = window.setTimeout(() => {
        setState(INITIAL_STATE);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let active = true;
    let topology = midiInputTopology(access.inputs.values());
    let topologyTimer = 0;

    const rescan = () => {
      if (!active) return;
      const inputs = midiClockInputOptions(access.inputs.values());
      const restored = restoreMidiClockInput(
        access.inputs.values(),
        selectedInputIdRef.current,
        preferredFingerprintRef.current,
      );
      const selected =
        restored ??
        (preferredFingerprintRef.current === null
          ? recommendedMidiClockInput(access.inputs.values())
          : null);
      selectedInputIdRef.current = selected?.id ?? null;
      if (selected && preferredFingerprintRef.current === null) {
        preferredFingerprintRef.current = midiInputFingerprint(selected);
      }
      setState((current) => ({
        ...current,
        inputs,
        selectedInputId: selected?.id ?? null,
        status:
          selected === null
            ? "Input disconnected"
            : enabled
              ? current.running
                ? "Running"
                : "Waiting for Start"
              : current.status,
      }));
    };

    const handleStateChange = () => {
      window.clearTimeout(topologyTimer);
      topologyTimer = window.setTimeout(() => {
        const nextTopology = midiInputTopology(access.inputs.values());
        if (nextTopology === topology) return;
        topology = nextTopology;
        rescan();
      }, 50);
    };

    const initialScanTimer = window.setTimeout(rescan, 0);
    access.addEventListener("statechange", handleStateChange);
    return () => {
      active = false;
      window.clearTimeout(initialScanTimer);
      window.clearTimeout(topologyTimer);
      access.removeEventListener("statechange", handleStateChange);
    };
  }, [access, enabled, resetTiming, stopClock]);

  const selectedInput = state.selectedInputId
    ? access?.inputs.get(state.selectedInputId) ?? null
    : null;
  useEffect(() => {
    if (!enabled) {
      stopClock();
      const timer = window.setTimeout(() => {
        setState((current) => ({
          ...current,
          running: false,
          status: access ? "Stopped" : "MIDI disconnected",
        }));
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (!access || !selectedInput) {
      stopClock();
      const timer = window.setTimeout(() => {
        setState((current) => ({
          ...current,
          running: false,
          status: access ? "Input disconnected" : "MIDI disconnected",
        }));
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let active = true;
    const listener = (event: Event) => {
      handleRealtimeMessage(event as MIDIMessageEvent);
    };
    const stateTimer = window.setTimeout(() => {
      setState((current) => ({
        ...current,
        error: null,
        status: current.running ? "Running" : "Waiting for Start",
      }));
    }, 0);
    void selectedInput.open().then(
      () => {
        if (!active) return;
        selectedInput.addEventListener("midimessage", listener);
      },
      () => {
        if (!active) return;
        setState((current) => ({
          ...current,
          error: "Could not open MIDI clock input.",
          status: "Input disconnected",
        }));
      },
    );

    return () => {
      active = false;
      window.clearTimeout(stateTimer);
      selectedInput.removeEventListener("midimessage", listener);
      stopClock();
    };
  }, [access, enabled, handleRealtimeMessage, selectedInput, stopClock]);

  const selectInput = useCallback(
    (inputId: string) => {
      const input = access?.inputs.get(inputId);
      if (!input) return;
      publishStopped(enabled ? "Waiting for Start" : "Stopped");
      resetTiming();
      selectedInputIdRef.current = input.id;
      preferredFingerprintRef.current = midiInputFingerprint(input);
      setState((current) => ({
        ...current,
        error: null,
        selectedInputId: input.id,
        status: enabled ? "Waiting for Start" : "Stopped",
      }));
    },
    [access, enabled, publishStopped, resetTiming],
  );

  const start = useCallback(async () => {
    if (!enabled || !selectedInputIdRef.current) return;
    armStart("start");
  }, [armStart, enabled]);

  const stop = useCallback(() => {
    publishStopped("Stopped");
  }, [publishStopped]);

  useEffect(
    () => () => {
      window.clearTimeout(clockLostTimerRef.current);
    },
    [],
  );

  return {
    ...state,
    selectInput,
    start,
    stop,
  };
}
