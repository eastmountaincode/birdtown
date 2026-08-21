"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  buildMidiClockSchedule,
  canClearMidiOutputQueue,
  clearMidiOutputQueue,
  midiClockOutputOptions,
  midiClockPulseIntervalMs,
  midiClockScheduleWindow,
  midiClockStartTiming,
  midiOutputFingerprint,
  midiOutputTopology,
  MIDI_START,
  MIDI_STOP,
  MIDI_TIMING_CLOCK,
  recommendedMidiClockOutputs,
  resolveMidiClockOutputs,
  restoreMidiClockOutputSelection,
  type MidiClockOutputOption,
} from "./midiClock";
import { clampTempo } from "./tempo";

const CLOCK_TEMPO_SETTLE_MS = 100;

function changePreferenceCount(
  preferences: Map<string, number>,
  fingerprint: string,
  change: number,
) {
  const nextCount = (preferences.get(fingerprint) ?? 0) + change;
  if (nextCount > 0) {
    preferences.set(fingerprint, nextCount);
  } else {
    preferences.delete(fingerprint);
  }
}

function preferenceCount(preferences: Map<string, number>) {
  return [...preferences.values()].reduce(
    (total, count) => total + count,
    0,
  );
}

function outputName(output: MIDIOutput) {
  return output.name?.trim() || "MIDI output";
}

function outputFailure(
  action: string,
  output: MIDIOutput,
  error: unknown,
) {
  const detail =
    error instanceof Error && error.message.trim()
      ? `: ${error.message.trim()}`
      : "";
  return `${action} on ${outputName(output)}${detail}`;
}

interface MidiClockState {
  error: string | null;
  outputs: MidiClockOutputOption[];
  running: boolean;
  selectedOutputIds: string[];
  starting: boolean;
}

const INITIAL_STATE: MidiClockState = {
  error: null,
  outputs: [],
  running: false,
  selectedOutputIds: [],
  starting: false,
};

export function useMidiClock({
  access,
  onTransportChange,
  tempoBpm,
}: {
  access: MIDIAccess | null;
  onTransportChange?: (running: boolean, startedAtMs: number | null) => void;
  tempoBpm: number;
}) {
  const [state, setState] = useState(INITIAL_STATE);
  const accessRef = useRef(access);
  const activeOutputsRef = useRef(new Map<string, MIDIOutput>());
  const closingOutputsRef = useRef<Promise<void>>(Promise.resolve());
  const fillQueueRef = useRef<() => void>(() => undefined);
  const knownOutputNamesRef = useRef(new Map<string, string>());
  const missingOutputPreferencesRef = useRef(new Map<string, string>());
  const nextPulseAtRef = useRef(0);
  const operationGenerationRef = useRef(0);
  const onTransportChangeRef = useRef(onTransportChange);
  const outputPreferencesRef = useRef(new Map<string, number>());
  const errorRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  const selectedOutputIdsRef = useRef(new Set<string>());
  const selectionInitializedRef = useRef(false);
  const startAttemptsRef = useRef<Promise<void>>(Promise.resolve());
  const startingRef = useRef(false);
  const tempoBpmRef = useRef(clampTempo(tempoBpm));
  const tempoChangeTimerRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    onTransportChangeRef.current = onTransportChange;
  }, [onTransportChange]);

  const closeActiveOutputs = useCallback(() => {
    const outputs = [...activeOutputsRef.current.values()];
    activeOutputsRef.current.clear();
    const closing = closingOutputsRef.current
      .catch(() => undefined)
      .then(() =>
        Promise.all(
          outputs.map((output) =>
            output.close().catch(() => undefined),
          ),
        ),
      )
      .then(() => undefined);
    closingOutputsRef.current = closing;
    return closing;
  }, []);

  const stopTransport = useCallback(
    (error: string | null = null, publish = true) => {
      operationGenerationRef.current += 1;
      window.clearTimeout(timerRef.current);
      window.clearTimeout(tempoChangeTimerRef.current);
      timerRef.current = 0;
      tempoChangeTimerRef.current = 0;

      const wasRunning = runningRef.current;
      const wasStarting = startingRef.current;
      runningRef.current = false;
      startingRef.current = false;
      if (wasRunning || wasStarting) {
        onTransportChangeRef.current?.(false, null);
      }
      for (const output of activeOutputsRef.current.values()) {
        try {
          clearMidiOutputQueue(output);
        } catch {
          // Stop must still be sent when queue clearing is unsupported or fails.
        }
        if (wasRunning || wasStarting) {
          try {
            output.send([MIDI_STOP]);
          } catch {
            // A disconnected output cannot receive the final transport message.
          }
        }
      }

      const errorChanged = error !== errorRef.current;
      errorRef.current = error;
      if (publish && (wasRunning || wasStarting || errorChanged)) {
        setState((current) => ({
          ...current,
          error,
          running: false,
          starting: false,
        }));
      }
    },
    [],
  );

  const fillQueue = useCallback(() => {
    if (!runningRef.current) return;

    const outputs = [...activeOutputsRef.current.values()];
    if (outputs.length === 0) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
      return;
    }

    const now = performance.now();
    const scheduleWindow = midiClockScheduleWindow(outputs);
    const schedule = buildMidiClockSchedule({
      nextPulseAt: nextPulseAtRef.current,
      now,
      tempoBpm: tempoBpmRef.current,
      until: now + scheduleWindow.lookaheadMs,
    });

    let currentOutput: MIDIOutput | null = null;
    try {
      for (const timestamp of schedule.timestamps) {
        for (const output of outputs) {
          currentOutput = output;
          output.send([MIDI_TIMING_CLOCK], timestamp);
        }
      }
    } catch (error) {
      stopTransport(
        currentOutput
          ? outputFailure("MIDI clock stopped", currentOutput, error)
          : "MIDI clock output was disconnected.",
      );
      return;
    }

    nextPulseAtRef.current = schedule.nextPulseAt;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(
      () => fillQueueRef.current(),
      scheduleWindow.refillMs,
    );
  }, [stopTransport]);

  useEffect(() => {
    fillQueueRef.current = fillQueue;
  }, [fillQueue]);

  useEffect(() => {
    const nextTempo = clampTempo(tempoBpm);
    if (nextTempo === tempoBpmRef.current) return;
    tempoBpmRef.current = nextTempo;
    if (!runningRef.current) return;

    window.clearTimeout(tempoChangeTimerRef.current);
    tempoChangeTimerRef.current = window.setTimeout(() => {
      if (!runningRef.current) return;
      window.clearTimeout(timerRef.current);
      const outputs = [...activeOutputsRef.current.values()];
      if (outputs.every(canClearMidiOutputQueue)) {
        for (const output of outputs) {
          try {
            clearMidiOutputQueue(output);
          } catch (error) {
            stopTransport(
              outputFailure(
                "Could not update MIDI clock tempo",
                output,
                error,
              ),
            );
            return;
          }
        }
        nextPulseAtRef.current =
          performance.now() +
          midiClockPulseIntervalMs(tempoBpmRef.current);
      }
      fillQueueRef.current();
    }, CLOCK_TEMPO_SETTLE_MS);
  }, [stopTransport, tempoBpm]);

  useEffect(() => {
    accessRef.current = access;
    if (!access) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
      void closeActiveOutputs();
      errorRef.current = null;
      const resetTimer = window.setTimeout(() => {
        setState((current) => ({
          ...current,
          error: null,
          outputs: [],
          running: runningRef.current,
          selectedOutputIds: [],
          starting: startingRef.current,
        }));
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    let active = true;
    let topology = midiOutputTopology(access.outputs.values());
    let topologyTimer = 0;

    const rescanOutputs = () => {
      if (!active || accessRef.current !== access) return;

      const availableOptions = midiClockOutputOptions(
        access.outputs.values(),
      );
      for (const output of availableOptions) {
        knownOutputNamesRef.current.set(output.fingerprint, output.name);
      }

      if (!selectionInitializedRef.current) {
        const recommended = recommendedMidiClockOutputs(
          access.outputs.values(),
        );
        selectedOutputIdsRef.current = new Set(
          recommended.map((output) => output.id),
        );
        for (const output of recommended) {
          changePreferenceCount(
            outputPreferencesRef.current,
            midiOutputFingerprint(output),
            1,
          );
        }
        selectionInitializedRef.current = true;
      }

      const restoredSelection = restoreMidiClockOutputSelection(
        access.outputs.values(),
        selectedOutputIdsRef.current,
        outputPreferencesRef.current,
      );
      selectedOutputIdsRef.current = new Set(
        restoredSelection.selectedIds,
      );

      const missingOptions: MidiClockOutputOption[] = [];
      const missingOutputPreferences = new Map<string, string>();
      for (const [index, fingerprint] of
        restoredSelection.missingFingerprints.entries()) {
        const id = `missing:${fingerprint}:${index}`;
        missingOutputPreferences.set(id, fingerprint);
        missingOptions.push({
          available: false,
          fingerprint,
          id,
          name:
            knownOutputNamesRef.current.get(fingerprint) ?? "MIDI output",
        });
      }
      missingOutputPreferencesRef.current = missingOutputPreferences;

      const activeOutputsStillAvailable = [
        ...activeOutputsRef.current.values(),
      ].every(
        (output) =>
          output.state !== "disconnected" &&
          access.outputs.get(output.id) === output,
      );
      if (!activeOutputsStillAvailable) {
        stopTransport("MIDI clock stopped because an output disconnected.");
        void closeActiveOutputs();
      }

      setState((current) => ({
        ...current,
        error: errorRef.current,
        outputs: [...availableOptions, ...missingOptions],
        running: runningRef.current,
        selectedOutputIds: [
          ...selectedOutputIdsRef.current,
          ...missingOutputPreferences.keys(),
        ],
        starting: startingRef.current,
      }));
    };

    const handleStateChange = () => {
      window.clearTimeout(topologyTimer);
      topologyTimer = window.setTimeout(() => {
        const nextTopology = midiOutputTopology(access.outputs.values());
        if (nextTopology === topology) return;
        topology = nextTopology;
        rescanOutputs();
      }, 50);
    };

    rescanOutputs();
    access.addEventListener("statechange", handleStateChange);

    return () => {
      active = false;
      window.clearTimeout(topologyTimer);
      access.removeEventListener("statechange", handleStateChange);
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
      void closeActiveOutputs();
    };
  }, [access, closeActiveOutputs, stopTransport]);

  const selectOutput = useCallback(
    (outputId: string, selected: boolean) => {
      const missingFingerprint =
        missingOutputPreferencesRef.current.get(outputId);
      if (missingFingerprint) {
        if (!selected) {
          changePreferenceCount(
            outputPreferencesRef.current,
            missingFingerprint,
            -1,
          );
          missingOutputPreferencesRef.current.delete(outputId);
          errorRef.current = null;
          setState((current) => ({
            ...current,
            error: null,
            outputs: current.outputs.filter(
              (output) => output.id !== outputId,
            ),
            selectedOutputIds: current.selectedOutputIds.filter(
              (id) => id !== outputId,
            ),
          }));
        }
        return;
      }

      const output = accessRef.current?.outputs.get(outputId);
      if (!output) return;
      const next = new Set(selectedOutputIdsRef.current);
      const wasSelected = next.has(outputId);
      if (selected && !wasSelected) {
        next.add(outputId);
        changePreferenceCount(
          outputPreferencesRef.current,
          midiOutputFingerprint(output),
          1,
        );
      } else if (!selected && wasSelected) {
        next.delete(outputId);
        changePreferenceCount(
          outputPreferencesRef.current,
          midiOutputFingerprint(output),
          -1,
        );
      }
      selectedOutputIdsRef.current = next;
      errorRef.current = null;
      setState((current) => ({
        ...current,
        error: null,
        selectedOutputIds: [
          ...next,
          ...missingOutputPreferencesRef.current.keys(),
        ],
      }));
    },
    [],
  );

  const performStart = useCallback(async () => {
    const initialAccess = accessRef.current;
    if (runningRef.current || startingRef.current) return;

    const generation = operationGenerationRef.current + 1;
    operationGenerationRef.current = generation;
    errorRef.current = null;
    startingRef.current = true;
    setState((current) => ({
      ...current,
      error: null,
      starting: true,
    }));

    if (!initialAccess) {
      const { downbeatAt: startAt } = midiClockStartTiming(
        performance.now(),
      );
      nextPulseAtRef.current = startAt;
      runningRef.current = true;
      startingRef.current = false;
      onTransportChangeRef.current?.(true, startAt);
      setState((current) => ({
        ...current,
        error: null,
        running: true,
        starting: false,
      }));
      return;
    }

    await closingOutputsRef.current.catch(() => undefined);
    if (
      generation !== operationGenerationRef.current ||
      accessRef.current !== initialAccess
    ) {
      return;
    }

    const currentAccess = accessRef.current;
    const selectedIds = selectedOutputIdsRef.current;
    const outputs = currentAccess
      ? resolveMidiClockOutputs(currentAccess.outputs.values(), selectedIds)
      : [];
    const outputErrors: string[] = [];
    if (
      currentAccess &&
      preferenceCount(outputPreferencesRef.current) > outputs.length
    ) {
      outputErrors.push("A selected MIDI clock output is disconnected.");
    }

    const opened = await Promise.allSettled(
      outputs.map(async (output) => {
        await output.open();
        return output;
      }),
    );
    const openedOutputs = opened.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );

    if (
      generation !== operationGenerationRef.current ||
      accessRef.current !== currentAccess
    ) {
      await Promise.all(
        openedOutputs.map((output) =>
          output.close().catch(() => undefined),
        ),
      );
      return;
    }

    if (openedOutputs.length !== outputs.length) {
      outputErrors.push("Could not open every selected MIDI clock output.");
    }

    activeOutputsRef.current = new Map(
      openedOutputs.map((output) => [output.id, output]),
    );

    const { downbeatAt: startAt, startMessageAt } = midiClockStartTiming(
      performance.now(),
    );
    for (const output of openedOutputs) {
      try {
        output.send([MIDI_START], startMessageAt);
      } catch (error) {
        outputErrors.push(outputFailure("Could not start MIDI clock", output, error));
        activeOutputsRef.current.delete(output.id);
        void output.close().catch(() => undefined);
      }
    }

    nextPulseAtRef.current = startAt;
    errorRef.current = outputErrors[0] ?? null;
    runningRef.current = true;
    startingRef.current = false;
    onTransportChangeRef.current?.(true, startAt);
    setState((current) => ({
      ...current,
      error: errorRef.current,
      running: true,
      starting: false,
    }));
    fillQueueRef.current();
  }, []);

  const start = useCallback(() => {
    const attempt = startAttemptsRef.current
      .catch(() => undefined)
      .then(performStart);
    startAttemptsRef.current = attempt;
    return attempt;
  }, [performStart]);

  const stop = useCallback(() => {
    stopTransport();
    void closeActiveOutputs();
  }, [closeActiveOutputs, stopTransport]);

  const selectedOutputKey = state.selectedOutputIds.join("|");
  const selectedOutputCount = state.selectedOutputIds.length;
  useEffect(() => {
    if (!access || !runningRef.current) return;
    const currentSelection = new Set(
      selectedOutputKey ? selectedOutputKey.split("|") : [],
    );
    const expectedSelection = new Set([
      ...selectedOutputIdsRef.current,
      ...missingOutputPreferencesRef.current.keys(),
    ]);
    if (
      selectedOutputCount !== expectedSelection.size ||
      [...currentSelection].some((id) => !expectedSelection.has(id))
    ) {
      return;
    }
    stopTransport(null, false);
    void closeActiveOutputs().then(start);
  }, [
    access,
    closeActiveOutputs,
    selectedOutputCount,
    selectedOutputKey,
    start,
    stopTransport,
  ]);

  const canStart = true;

  return {
    ...state,
    canStart,
    selectOutput,
    start,
    stop,
  };
}
