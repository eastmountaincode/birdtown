"use client";

import { useCallback, useRef, useState } from "react";
import { instrumentNoteForMidiNote } from "./midi";
import {
  DEFAULT_SEQUENCE,
  isSequencerNote,
  setSequenceNote,
  STOPPED_SEQUENCER_TRANSPORT,
} from "./sequencer";
import { useSequencerPlayhead } from "./useSequencerPlayhead";

export function useMelodicSequencer(tempoBpm: number) {
  const [sequence, setSequence] = useState(DEFAULT_SEQUENCE);
  const [recording, setRecordingState] = useState(false);
  const [transport, setTransport] = useState(
    STOPPED_SEQUENCER_TRANSPORT,
  );
  const recordingRef = useRef(false);
  const activeNoteRef = useRef<number | null>(null);
  const activeStepRef = useRef<number | null>(null);

  const recordStep = useCallback((step: number) => {
    activeStepRef.current = step;
    const note = activeNoteRef.current;
    if (!recordingRef.current || note === null) return;
    setSequence((current) => setSequenceNote(current, step, note));
  }, []);

  const activeStep = useSequencerPlayhead(
    sequence,
    transport,
    tempoBpm,
    recordStep,
  );

  const setActiveMidiNote = useCallback((midiNote: number | null) => {
    const note =
      midiNote === null ? null : instrumentNoteForMidiNote(midiNote);
    activeNoteRef.current = note;
    const step = activeStepRef.current;
    if (
      note !== null &&
      isSequencerNote(note) &&
      recordingRef.current &&
      step !== null
    ) {
      setSequence((current) => setSequenceNote(current, step, note));
    }
  }, []);

  const setRecording = useCallback(
    (nextRecording: boolean) => {
      recordingRef.current = nextRecording;
      setRecordingState(nextRecording);
      const step = activeStepRef.current;
      if (nextRecording && step !== null) recordStep(step);
    },
    [recordStep],
  );

  const setClockTransport = useCallback(
    (running: boolean, startedAtMs: number | null) => {
      setTransport({ running, startedAtMs });
    },
    [],
  );

  return {
    activeStep,
    recording,
    sequence,
    setActiveMidiNote,
    setClockTransport,
    setRecording,
    setSequence,
    transport,
  };
}
