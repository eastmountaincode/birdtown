"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_AUDIO_OUTPUT,
  readAudioOutputPreference,
  revealAudioOutputs,
  selectNativeAudioOutput,
  supportsAudioOutputRouting,
  supportsNativeAudioOutputPicker,
  type AudioOutputDevice,
  writeAudioOutputPreference,
} from "./audioOutput";

function includeSelectedOutput(
  outputs: AudioOutputDevice[],
  selected: AudioOutputDevice,
) {
  if (
    selected.deviceId === "" ||
    outputs.some(({ deviceId }) => deviceId === selected.deviceId)
  ) {
    return outputs;
  }
  return [...outputs, selected];
}

function outputSelectionError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Allow audio access to list output devices.";
  }
  return error instanceof Error
    ? error.message
    : "Audio outputs could not be opened.";
}

function subscribeToOutputSupport() {
  return () => undefined;
}

export function useAudioOutput(
  applyOutput: (deviceId: string) => Promise<void>,
) {
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<AudioOutputDevice[]>([
    DEFAULT_AUDIO_OUTPUT,
  ]);
  const [selected, setSelected] =
    useState<AudioOutputDevice>(DEFAULT_AUDIO_OUTPUT);
  const supported = useSyncExternalStore(
    subscribeToOutputSupport,
    supportsAudioOutputRouting,
    () => false,
  );

  useEffect(() => {
    if (!supported) return;
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return;
      const stored = readAudioOutputPreference(window.localStorage);
      setSelected(stored);
      setOutputs((current) => includeSelectedOutput(current, stored));
      void applyOutput(stored.deviceId);
    });

    return () => {
      active = false;
    };
  }, [applyOutput, supported]);

  const commitOutput = useCallback(
    async (output: AudioOutputDevice) => {
      await applyOutput(output.deviceId);
      setSelected(output);
      setOutputs((current) => includeSelectedOutput(current, output));
      writeAudioOutputPreference(window.localStorage, output);
      setError(null);
    },
    [applyOutput],
  );

  const choose = useCallback(async () => {
    if (!supported || choosing) return;
    setChoosing(true);
    setError(null);
    try {
      if (supportsNativeAudioOutputPicker()) {
        const output = await selectNativeAudioOutput();
        if (output) await commitOutput(output);
        return;
      }

      const available = await revealAudioOutputs();
      setOutputs(includeSelectedOutput(available, selected));
      if (available.length === 1) {
        setError("No additional audio outputs were found.");
      }
    } catch (selectionError) {
      setError(outputSelectionError(selectionError));
    } finally {
      setChoosing(false);
    }
  }, [choosing, commitOutput, selected, supported]);

  const select = useCallback(
    async (deviceId: string) => {
      const output = outputs.find((option) => option.deviceId === deviceId);
      if (!output || output.deviceId === selected.deviceId) return;
      setError(null);
      try {
        await commitOutput(output);
      } catch (selectionError) {
        setError(outputSelectionError(selectionError));
      }
    },
    [commitOutput, outputs, selected.deviceId],
  );

  return {
    choose,
    choosing,
    error,
    outputs,
    select,
    selected,
    supported,
  };
}
