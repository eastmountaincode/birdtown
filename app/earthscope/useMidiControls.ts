"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { VoiceControls } from "./controls";
import {
  applyMidiControl,
  decodeRelativeMidiValue,
  listMidiInputSelections,
  midiInputTopology,
  moveSampleCountRelatively,
  MPK_MINI_KNOB_CONTROLS,
  MPK_MINI_KEY_CHANNEL,
  parseControlChange,
  parseNoteMessage,
  parsePitchBend,
  pitchBendRatio,
  playableRepeatRateForMidiNote,
  resolveMidiInputSelection,
  type MidiInputOption,
  type MidiInputSelection,
} from "./midi";

interface MidiConnectionState {
  connected: boolean;
  connecting: boolean;
  inputs: MidiInputOption[];
  midiAccess: MIDIAccess | null;
  selectedInputKey: string | null;
}

interface HeldMidiNote {
  inputId: string;
  note: number;
}

const DISCONNECTED: MidiConnectionState = {
  connected: false,
  connecting: false,
  inputs: [],
  midiAccess: null,
  selectedInputKey: null,
};

function isMpkDawPort(input: MIDIInput) {
  const name = input.name?.toLowerCase() ?? "";
  return name.includes("mpk mini") && name.includes("daw port");
}

export function useMidiControls({
  controls,
  onHeldKeysChange,
  setControls,
  setPitchBendRatio,
  setRepeatsPerSecond,
}: {
  controls: VoiceControls;
  onHeldKeysChange: (hasHeldKeys: boolean) => void;
  setControls: Dispatch<SetStateAction<VoiceControls>>;
  setPitchBendRatio: (ratio: number) => void;
  setRepeatsPerSecond: (value: number) => void;
}) {
  const [connection, setConnection] =
    useState<MidiConnectionState>(DISCONNECTED);
  const accessGenerationRef = useRef(0);
  const accessRef = useRef<MIDIAccess | null>(null);
  const activeInputsRef = useRef(new Map<string, MIDIInput>());
  const closingByInputRef = useRef(
    new WeakMap<MIDIInput, Promise<void>>(),
  );
  const controlsRef = useRef(controls);
  const desiredInputsRef = useRef(new Map<string, MIDIInput>());
  const heldNotesRef = useRef<HeldMidiNote[]>([]);
  const hasHeldKeysRef = useRef(false);
  const onHeldKeysChangeRef = useRef(onHeldKeysChange);
  const pendingInputsRef = useRef(new Map<string, MIDIInput>());
  const pitchBendInputIdRef = useRef<string | null>(null);
  const preferredSelectionKeyRef = useRef<string | null>(null);
  const sampleCountTargetRef = useRef<number | null>(null);
  const selectionGenerationRef = useRef(0);
  const portOperationQueueRef = useRef(new Map<string, Promise<void>>());
  const topologyDirtyRef = useRef(false);
  const topologyRef = useRef("");
  const topologyTimerRef = useRef(0);

  useEffect(() => {
    onHeldKeysChangeRef.current = onHeldKeysChange;
  }, [onHeldKeysChange]);

  useEffect(() => {
    controlsRef.current = controls;
    const target = sampleCountTargetRef.current;
    if (target !== null && Math.round(target) !== controls.sampleCount) {
      sampleCountTargetRef.current = controls.sampleCount;
    }
  }, [controls]);

  const enqueuePortOperation = useCallback(
    function enqueue<T>(
      inputId: string,
      operation: () => Promise<T>,
    ): Promise<T> {
      const previous =
        portOperationQueueRef.current.get(inputId) ?? Promise.resolve();
      const result = previous.catch(() => undefined).then(operation);
      const tail = result
        .then(
          () => undefined,
          () => undefined,
        )
        .finally(() => {
          if (portOperationQueueRef.current.get(inputId) === tail) {
            portOperationQueueRef.current.delete(inputId);
          }
        });
      portOperationQueueRef.current.set(inputId, tail);
      return result;
    },
    [],
  );

  const selectRepeatRate = useCallback(
    (rate: number) => {
      setRepeatsPerSecond(rate);
      const current = controlsRef.current;
      if (current.repeatsPerSecond === rate) return;
      const next = { ...current, repeatsPerSecond: rate };
      controlsRef.current = next;
      setControls(next);
    },
    [setControls, setRepeatsPerSecond],
  );

  const setHeldNotes = useCallback((heldNotes: HeldMidiNote[]) => {
    heldNotesRef.current = heldNotes;
    const hasHeldKeys = heldNotes.length > 0;
    if (hasHeldKeys === hasHeldKeysRef.current) return;
    hasHeldKeysRef.current = hasHeldKeys;
    onHeldKeysChangeRef.current(hasHeldKeys);
  }, []);

  const resetPitchBend = useCallback(
    (inputId?: string) => {
      if (
        inputId !== undefined &&
        pitchBendInputIdRef.current !== inputId
      ) {
        return;
      }
      pitchBendInputIdRef.current = null;
      setPitchBendRatio(1);
    },
    [setPitchBendRatio],
  );

  const closeInput = useCallback((input: MIDIInput) => {
    input.onmidimessage = null;
    const existing = closingByInputRef.current.get(input);
    if (existing) return existing;

    const closing = enqueuePortOperation(input.id, () => input.close())
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => {
        if (closingByInputRef.current.get(input) === closing) {
          closingByInputRef.current.delete(input);
        }
      });
    closingByInputRef.current.set(input, closing);
    return closing;
  }, [enqueuePortOperation]);

  const detachInputs = useCallback(() => {
    selectionGenerationRef.current += 1;
    desiredInputsRef.current.clear();
    setHeldNotes([]);
    resetPitchBend();
    sampleCountTargetRef.current = null;

    const inputs = new Set<MIDIInput>([
      ...activeInputsRef.current.values(),
      ...pendingInputsRef.current.values(),
    ]);
    activeInputsRef.current.clear();
    pendingInputsRef.current.clear();
    return Promise.all([...inputs].map(closeInput));
  }, [closeInput, resetPitchBend, setHeldNotes]);

  const removeHeldNotesForInput = useCallback(
    (inputId: string) => {
      resetPitchBend(inputId);
      const heldNotes = heldNotesRef.current;
      const wasActive = heldNotes.at(-1)?.inputId === inputId;
      const remaining = heldNotes.filter((held) => held.inputId !== inputId);
      if (wasActive) {
        const fallback = remaining.at(-1);
        const fallbackRate = fallback
          ? playableRepeatRateForMidiNote(fallback.note)
          : null;
        if (fallbackRate !== null) selectRepeatRate(fallbackRate);
      }
      setHeldNotes(remaining);
    },
    [resetPitchBend, selectRepeatRate, setHeldNotes],
  );

  const handleMidiMessage = useCallback(
    (input: MIDIInput, event: MIDIMessageEvent) => {
      if (
        activeInputsRef.current.get(input.id) !== input ||
        !event.data
      ) {
        return;
      }

      const noteMessage = parseNoteMessage(event.data);
      if (
        noteMessage &&
        noteMessage.channel === MPK_MINI_KEY_CHANNEL &&
        !isMpkDawPort(input)
      ) {
        if (noteMessage.type === "on") {
          const selectedRate = playableRepeatRateForMidiNote(noteMessage.note);
          if (selectedRate === null) return;

          const nextHeldNotes = [
            ...heldNotesRef.current.filter(
              (held) =>
                held.inputId !== input.id || held.note !== noteMessage.note,
            ),
            { inputId: input.id, note: noteMessage.note },
          ];
          selectRepeatRate(selectedRate);
          setHeldNotes(nextHeldNotes);
        } else {
          const heldNotes = heldNotesRef.current;
          const wasActive =
            heldNotes.at(-1)?.inputId === input.id &&
            heldNotes.at(-1)?.note === noteMessage.note;
          const remaining = heldNotes.filter(
            (held) =>
              held.inputId !== input.id || held.note !== noteMessage.note,
          );
          if (wasActive) {
            const fallback = remaining.at(-1);
            const fallbackRate = fallback
              ? playableRepeatRateForMidiNote(fallback.note)
              : null;
            if (fallbackRate !== null) selectRepeatRate(fallbackRate);
          }
          setHeldNotes(remaining);
        }

        return;
      }

      const pitchBend = parsePitchBend(event.data);
      if (
        pitchBend &&
        pitchBend.channel === MPK_MINI_KEY_CHANNEL &&
        !isMpkDawPort(input)
      ) {
        const ratio = pitchBendRatio(pitchBend.value);
        pitchBendInputIdRef.current = ratio === 1 ? null : input.id;
        setPitchBendRatio(ratio);
        return;
      }

      const message = parseControlChange(event.data);
      if (!message) return;
      const mapped = Object.prototype.hasOwnProperty.call(
        MPK_MINI_KNOB_CONTROLS,
        message.controller,
      );

      if (mapped) {
        if (message.controller === 24) {
          const current = controlsRef.current;
          const storedTarget = sampleCountTargetRef.current;
          const target =
            storedTarget !== null &&
            Math.round(storedTarget) === current.sampleCount
              ? storedTarget
              : current.sampleCount;
          const movement = moveSampleCountRelatively(
            target,
            decodeRelativeMidiValue(message.rawValue),
          );
          sampleCountTargetRef.current = movement.target;
          if (movement.sampleCount !== current.sampleCount) {
            const next = {
              ...current,
              sampleCount: movement.sampleCount,
            };
            controlsRef.current = next;
            setControls(next);
          }
        } else {
          const current = controlsRef.current;
          const next = applyMidiControl(
            current,
            message.controller,
            message.rawValue,
          );
          if (next !== current) {
            controlsRef.current = next;
            setControls(next);
          }
        }
      }
    },
    [
      selectRepeatRate,
      setControls,
      setHeldNotes,
      setPitchBendRatio,
    ],
  );

  const reconcileInputSelection = useCallback(
    async (selection: MidiInputSelection<MIDIInput>) => {
      const access = accessRef.current;
      if (!access) return;

      const changingSelection =
        preferredSelectionKeyRef.current !== selection.key;
      const previousClose = changingSelection
        ? detachInputs()
        : Promise.resolve([]);
      preferredSelectionKeyRef.current = selection.key;
      const selectionGeneration = selectionGenerationRef.current;
      const desiredInputs = new Map(
        selection.inputs.map((input) => [input.id, input]),
      );
      desiredInputsRef.current = desiredInputs;

      const staleInputs = new Set<MIDIInput>();
      for (const [inputId, input] of [
        ...activeInputsRef.current,
        ...pendingInputsRef.current,
      ]) {
        if (desiredInputs.get(inputId) === input) continue;
        staleInputs.add(input);
        if (activeInputsRef.current.get(inputId) === input) {
          activeInputsRef.current.delete(inputId);
          removeHeldNotesForInput(inputId);
        }
        if (pendingInputsRef.current.get(inputId) === input) {
          pendingInputsRef.current.delete(inputId);
        }
      }

      const inputsToOpen = selection.inputs.filter((input) => {
        if (activeInputsRef.current.get(input.id) === input) return false;
        if (pendingInputsRef.current.get(input.id) === input) return false;
        pendingInputsRef.current.set(input.id, input);
        return true;
      });

      setConnection((current) => ({
        ...current,
        connected: true,
        connecting: false,
        selectedInputKey: selection.key,
      }));

      const staleCloses = Promise.all(
        [...staleInputs].map(closeInput),
      );
      const selectionStillCurrent = () =>
        selectionGeneration === selectionGenerationRef.current &&
        accessRef.current === access &&
        preferredSelectionKeyRef.current === selection.key;
      const inputStillDesired = (input: MIDIInput) =>
        selectionStillCurrent() &&
        desiredInputsRef.current.get(input.id) === input &&
        access.inputs.get(input.id) === input &&
        pendingInputsRef.current.get(input.id) === input;

      await Promise.all(
        inputsToOpen.map(async (input) => {
          try {
            await previousClose;
            await staleCloses;
            if (!inputStillDesired(input)) return null;

            await enqueuePortOperation(input.id, () => input.open());
            if (!inputStillDesired(input)) {
              if (
                activeInputsRef.current.get(input.id) !== input &&
                pendingInputsRef.current.get(input.id) !== input
              ) {
                void closeInput(input);
              }
              return null;
            }

            pendingInputsRef.current.delete(input.id);
            activeInputsRef.current.set(input.id, input);
            input.onmidimessage = (event) =>
              handleMidiMessage(input, event);
          } catch {
            if (pendingInputsRef.current.get(input.id) === input) {
              pendingInputsRef.current.delete(input.id);
            }
          }
        }),
      );
    },
    [
      closeInput,
      detachInputs,
      enqueuePortOperation,
      handleMidiMessage,
      removeHeldNotesForInput,
    ],
  );

  const rescanInputs = useCallback(async () => {
    const access = accessRef.current;
    if (!access) return;

    const selections = listMidiInputSelections(access.inputs.values());
    const options = selections.map(({ key, name }) => ({
      id: key,
      name,
    }));
    const target = resolveMidiInputSelection(
      access.inputs.values(),
      preferredSelectionKeyRef.current,
    );

    setConnection((current) => ({
      ...current,
      connected: true,
      connecting: false,
      inputs: options,
      midiAccess: access,
      selectedInputKey: target?.key ?? null,
    }));

    if (target) {
      await reconcileInputSelection(target);
      return;
    }

    void detachInputs();
    setConnection((current) => ({
      ...current,
      connected: true,
      connecting: false,
      inputs: options,
      midiAccess: access,
      selectedInputKey: null,
    }));
  }, [detachInputs, reconcileInputSelection]);

  const release = useCallback(
    (publish = true) => {
      accessGenerationRef.current += 1;
      window.clearTimeout(topologyTimerRef.current);
      void detachInputs();
      if (accessRef.current) {
        accessRef.current.onstatechange = null;
        accessRef.current = null;
      }
      topologyDirtyRef.current = false;
      topologyRef.current = "";
      if (publish) setConnection(DISCONNECTED);
    },
    [detachInputs],
  );

  const connect = useCallback(async () => {
    if (!("requestMIDIAccess" in navigator)) {
      setConnection(DISCONNECTED);
      return;
    }

    release(false);
    const accessGeneration = accessGenerationRef.current;
    setConnection({
      ...DISCONNECTED,
      connecting: true,
    });

    try {
      const access = await navigator.requestMIDIAccess();
      if (accessGeneration !== accessGenerationRef.current) return;
      accessRef.current = access;
      topologyRef.current = midiInputTopology(access.inputs.values());
      access.onstatechange = () => {
        const eventTopology = midiInputTopology(access.inputs.values());
        if (eventTopology !== topologyRef.current) {
          topologyDirtyRef.current = true;
        }
        window.clearTimeout(topologyTimerRef.current);
        topologyTimerRef.current = window.setTimeout(() => {
          if (accessRef.current !== access) return;
          const nextTopology = midiInputTopology(access.inputs.values());
          const shouldRescan =
            topologyDirtyRef.current || nextTopology !== topologyRef.current;
          topologyDirtyRef.current = false;
          if (!shouldRescan) return;
          topologyRef.current = nextTopology;
          void rescanInputs();
        }, 50);
      };
      await rescanInputs();
    } catch {
      if (accessGeneration !== accessGenerationRef.current) return;
      release(false);
      setConnection(DISCONNECTED);
    }
  }, [release, rescanInputs]);

  const selectInput = useCallback(
    async (inputKey: string) => {
      const access = accessRef.current;
      if (!access) return;
      const selection = resolveMidiInputSelection(
        access.inputs.values(),
        inputKey,
      );
      if (!selection) return;
      await reconcileInputSelection(selection);
    },
    [reconcileInputSelection],
  );

  useEffect(() => () => release(false), [release]);

  return {
    ...connection,
    connect,
    disconnect: release,
    selectInput,
  };
}
