"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveMidiClockOutputs } from "./midiClock";

export function useMidiClockThru({
  access,
  enabled,
  selectedOutputIds,
}: {
  access: MIDIAccess | null;
  enabled: boolean;
  selectedOutputIds: readonly string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const outputsRef = useRef(new Map<string, MIDIOutput>());
  const selectedOutputKey = [...selectedOutputIds].sort().join("|");

  useEffect(() => {
    outputsRef.current.clear();
    if (!access || !enabled) {
      const timer = window.setTimeout(() => setError(null), 0);
      return () => window.clearTimeout(timer);
    }

    let active = true;
    let scanGeneration = 0;
    let scanTimer = 0;

    const openSelectedOutputs = async () => {
      const generation = ++scanGeneration;
      const selectedIds = selectedOutputKey
        ? selectedOutputKey.split("|")
        : [];
      const outputs = resolveMidiClockOutputs(
        access.outputs.values(),
        selectedIds,
      );
      const results = await Promise.allSettled(
        outputs.map(async (output) => {
          await output.open();
          return output;
        }),
      );
      if (!active || generation !== scanGeneration) return;
      const opened = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      outputsRef.current = new Map(
        opened.map((output) => [output.id, output]),
      );
      setError(
        opened.length === outputs.length
          ? null
          : "Could not open every MIDI thru output.",
      );
    };

    const scheduleScan = () => {
      window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => void openSelectedOutputs(), 0);
    };

    scheduleScan();
    access.addEventListener("statechange", scheduleScan);
    return () => {
      active = false;
      scanGeneration += 1;
      window.clearTimeout(scanTimer);
      access.removeEventListener("statechange", scheduleScan);
      outputsRef.current.clear();
    };
  }, [access, enabled, selectedOutputKey]);

  const send = useCallback((status: number) => {
    for (const output of outputsRef.current.values()) {
      try {
        output.send([status]);
      } catch {
        // A topology scan removes disconnected outputs.
      }
    }
  }, []);

  return { error, send };
}
