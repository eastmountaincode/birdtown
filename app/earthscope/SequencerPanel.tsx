import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { quantizeSequence } from "./sequenceQuantize";
import {
  canTransposeSequence,
  clearSequence,
  SEQUENCE_LENGTHS,
  sequencerNoteName,
  sequencerNotesForOctave,
  setSequenceEnabled,
  setSequenceNote,
  toggleSequenceNote,
  transposeSequence,
  type MelodicSequence,
  type SequenceLength,
} from "./sequencer";

export function SequencerPanel({
  activeStep,
  onChange,
  onLengthChange,
  onRecordingChange,
  recording,
  sequence,
}: {
  activeStep: number | null;
  onChange: Dispatch<SetStateAction<MelodicSequence>>;
  onLengthChange: (length: SequenceLength) => void;
  onRecordingChange: (recording: boolean) => void;
  recording: boolean;
  sequence: MelodicSequence;
}) {
  const [octave, setOctave] = useState(2);
  const [octaveInput, setOctaveInput] = useState("2");
  const paintRef = useRef<{
    mode: "draw" | "erase";
    pointerId: number;
    visited: Set<string>;
  } | null>(null);
  const visibleNotes = sequencerNotesForOctave(octave);

  useEffect(() => {
    const finishPaint = (event: PointerEvent) => {
      if (paintRef.current?.pointerId === event.pointerId) {
        paintRef.current = null;
      }
    };
    window.addEventListener("pointerup", finishPaint);
    window.addEventListener("pointercancel", finishPaint);
    return () => {
      window.removeEventListener("pointerup", finishPaint);
      window.removeEventListener("pointercancel", finishPaint);
    };
  }, []);

  const paintCell = useCallback(
    (step: number, note: number) => {
      const paint = paintRef.current;
      if (!paint) return;
      const key = `${step}:${note}`;
      if (paint.visited.has(key)) return;
      paint.visited.add(key);
      onChange((current) =>
        setSequenceNote(
          current,
          step,
          paint.mode === "erase" ? null : note,
        ),
      );
    },
    [onChange],
  );

  const movePaint = (event: ReactPointerEvent<HTMLTableElement>) => {
    const paint = paintRef.current;
    if (!paint || paint.pointerId !== event.pointerId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const button = target?.closest<HTMLButtonElement>(
      "button[data-sequencer-note]",
    );
    if (!button || !event.currentTarget.contains(button)) return;
    paintCell(
      Number(button.dataset.sequencerStep),
      Number(button.dataset.sequencerNote),
    );
  };

  return (
    <fieldset className="plain-fieldset sequencer">
      <legend>Sequencer</legend>
      <div className="sequencer-controls">
        <label className="sequencer-step-control">
          Steps
          <select
            value={sequence.length}
            onChange={(event) => onLengthChange(Number(event.target.value) as SequenceLength)}
          >
            {SEQUENCE_LENGTHS.map((length) => (
              <option key={length} value={length}>{length}</option>
            ))}
          </select>
        </label>
        <label className="sequencer-octave-control">
            Octave
            <input
                type="number"
                step={1}
                value={octaveInput}
                onChange={(event) => {
                    const value = event.target.value;
                    setOctaveInput(value);
                    if (value !== "" && sequencerNotesForOctave(Number(value)).length > 0) {
                        setOctave(Number(value));
                    }
                }}
                onBlur={() => setOctaveInput(String(octave))}
            />
        </label>
        <div className="sequencer-transpose-buttons">
          <button
            aria-label="Octave down"
            disabled={!canTransposeSequence(sequence, -12)}
            onClick={() => {
                onChange((current) => transposeSequence(current, -12));
                if (sequencerNotesForOctave(octave - 1).length > 0) {
                    setOctave(octave - 1);
                    setOctaveInput(String(octave - 1));
                }
            }}
            type="button"
          >
            ↓
          </button>
          <button
            aria-label="Octave up"
            disabled={!canTransposeSequence(sequence, 12)}
            onClick={() => {
                onChange((current) => transposeSequence(current, 12));
                if (sequencerNotesForOctave(octave + 1).length > 0) {
                    setOctave(octave + 1);
                    setOctaveInput(String(octave + 1));
                }
            }}
            type="button"
          >
            ↑
          </button>
        </div>
        <button
          disabled={!sequence.notes.slice(0, sequence.length).some(note => note !== null)}
          onClick={() => {
            onRecordingChange(false);
            onChange(quantizeSequence);
          }}
          type="button"
        >
          Quantize
        </button>
        <button
          disabled={!sequence.notes.some((note) => note !== null)}
          onClick={() => onChange(clearSequence)}
          type="button"
        >
          Clear
        </button>
        <div className="sequencer-action-buttons">
          <button
            aria-pressed={sequence.enabled}
            onClick={() =>
              onChange((current) =>
                setSequenceEnabled(current, !current.enabled),
              )
            }
            type="button"
          >
            {sequence.enabled ? "On" : "Off"}
          </button>
          <button
            aria-pressed={recording}
            onClick={() => onRecordingChange(!recording)}
            type="button"
          >
            {recording ? "Record On" : "Record Off"}
          </button>
        </div>
      </div>
      <div className="sequencer-grid-wrap">
        <table className="sequencer-grid" onPointerMove={movePaint}>
          <thead>
            <tr>
              <th aria-label="Note" />
              {Array.from({ length: sequence.length }, (_, step) => (
                <th
                  className={activeStep === step ? "is-current" : undefined}
                  key={step}
                  scope="col"
                >
                  {step + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleNotes.map((note) => {
              const noteName = sequencerNoteName(note);
              return (
                <tr key={note}>
                  <th scope="row">{noteName}</th>
                  {Array.from({ length: sequence.length }, (_, step) => {
                    const selected = sequence.notes[step] === note;
                    return (
                      <td key={step}>
                        <button
                          aria-label={`${noteName}, step ${step + 1}`}
                          aria-pressed={selected}
                          className={activeStep === step ? "is-current" : undefined}
                          data-sequencer-note={note}
                          data-sequencer-step={step}
                          onClick={(event) => {
                            if (event.detail === 0) {
                              onChange((current) =>
                                toggleSequenceNote(current, step, note),
                              );
                            }
                          }}
                          onPointerDown={(event) => {
                            if (!event.isPrimary || event.button !== 0) return;
                            event.preventDefault();
                            paintRef.current = {
                              mode: selected ? "erase" : "draw",
                              pointerId: event.pointerId,
                              visited: new Set(),
                            };
                            paintCell(step, note);
                          }}
                          style={selected && sequence.gates?.[step] ? {
                            background: `linear-gradient(to right, ${sequence.gates[step]!.flatMap(gate => [
                              `white ${gate.start * 100}%`, `#111 ${gate.start * 100}%`,
                              `#111 ${gate.end * 100}%`, `white ${gate.end * 100}%`,
                            ]).join(', ')})`,
                          } : undefined}
                          type="button"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}
