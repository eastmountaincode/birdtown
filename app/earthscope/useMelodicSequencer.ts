"use client";

import { useCallback, useRef, useState, type SetStateAction } from "react";
import { instrumentNoteForMidiNote } from "./midi";
import { advanceSequenceRecording, type RecordingCursor } from "./sequenceRecording";
import {
  DEFAULT_SEQUENCE, isSequencerNote, retimeTransportForSequenceLength,
  sequenceStepDurationSeconds, setSequenceLength, STOPPED_SEQUENCER_TRANSPORT,
  type MelodicSequence, type SequenceLength,
} from "./sequencer";
import { useSequencerPlayhead } from "./useSequencerPlayhead";

export function useMelodicSequencer(tempoBpm: number) {
  const [take, setTake] = useState<{ sequence: MelodicSequence; cursor: RecordingCursor | null }>({
    sequence: DEFAULT_SEQUENCE, cursor: null,
  });
  const sequence = take.sequence;
  const [recording, setRecordingState] = useState(false);
  const [transport, setTransport] = useState(STOPPED_SEQUENCER_TRANSPORT);
  const transportRef = useRef(STOPPED_SEQUENCER_TRANSPORT);
  const recordingRef = useRef(false);
  const activeNoteRef = useRef<number | null>(null);

  const recordUntil = useCallback((note: number | null, nowMs = performance.now(), finish = false) => {
    if (!recordingRef.current) return;
    const clock = transportRef.current;
    if (!clock.running || clock.startedAtMs === null || nowMs < clock.startedAtMs) return;
    const position = (nowMs - clock.startedAtMs) / (sequenceStepDurationSeconds(tempoBpm) * 1000);
    setTake(current => {
      const next = advanceSequenceRecording(current.sequence, current.cursor, position, note);
      return finish ? { ...next, cursor: null } : next;
    });
  }, [tempoBpm]);

  const recordStep = useCallback(() => recordUntil(activeNoteRef.current), [recordUntil]);
  const activeStep = useSequencerPlayhead(sequence, transport, tempoBpm, recordStep);

  const setActiveMidiNote = useCallback((midiNote: number | null, receivedAtMs?: number) => {
    const mapped = midiNote === null ? null : instrumentNoteForMidiNote(midiNote);
    const note = mapped !== null && isSequencerNote(mapped) ? mapped : null;
    recordUntil(note, receivedAtMs);
    activeNoteRef.current = note;
  }, [recordUntil]);

  const setRecording = useCallback((next: boolean) => {
    if (!next) recordUntil(activeNoteRef.current, performance.now(), true);
    recordingRef.current = next;
    setRecordingState(next);
    if (next) recordUntil(activeNoteRef.current);
  }, [recordUntil]);

  const setClockTransport = useCallback((running: boolean, startedAtMs: number | null) => {
    recordUntil(activeNoteRef.current, performance.now(), true);
    const next = { running, startedAtMs };
    transportRef.current = next;
    setTransport(next);
    if (running) recordUntil(activeNoteRef.current);
  }, [recordUntil]);

  const setSequence = useCallback((update: SetStateAction<MelodicSequence>) => {
    setTake(current => ({ ...current, sequence: typeof update === 'function' ? update(current.sequence) : update }));
  }, []);

  const changeSequenceLength = useCallback((nextLength: SequenceLength) => {
    const nowMs = performance.now();
    recordUntil(activeNoteRef.current, nowMs, true);
    const next = retimeTransportForSequenceLength({
      currentLength: sequence.length, nextLength, nowMs, tempoBpm, transport: transportRef.current,
    });
    transportRef.current = next;
    setTransport(next);
    setSequence(current => setSequenceLength(current, nextLength));
    recordUntil(activeNoteRef.current, nowMs);
  }, [recordUntil, sequence.length, setSequence, tempoBpm]);

  return { activeStep, changeSequenceLength, recording, sequence, setActiveMidiNote,
    setClockTransport, setRecording, setSequence, transport };
}
