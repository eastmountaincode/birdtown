import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import {
  clearSequence,
  SEQUENCE_LENGTHS,
  SEQUENCER_OCTAVES,
  sequencerNoteName,
  sequencerNotesForOctave,
  setSequenceEnabled,
  setSequenceLength,
  setSequenceNote,
  toggleSequenceNote,
  type MelodicSequence,
  type SequencerOctave,
} from "./sequencer";

export function SequencerPanel({
  activeStep,
  onChange,
  onRecordingChange,
  recording,
  sequence,
}: {
  activeStep: number | null;
  onChange: Dispatch<SetStateAction<MelodicSequence>>;
  onRecordingChange: (recording: boolean) => void;
  recording: boolean;
  sequence: MelodicSequence;
}) {
  const [octave, setOctave] = useState<SequencerOctave>(2);
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
        <div className="sequencer-step-control">
          <span id="sequencer-step-label">Steps</span>
          <div
            aria-labelledby="sequencer-step-label"
            className="sequencer-step-options"
            role="radiogroup"
          >
            {SEQUENCE_LENGTHS.map((length) => (
              <label key={length}>
                <input
                  checked={sequence.length === length}
                  name="sequencer-steps"
                  onChange={() =>
                    onChange((current) =>
                      setSequenceLength(current, length),
                    )
                  }
                  type="radio"
                />
                {length}
              </label>
            ))}
          </div>
        </div>
        <div className="sequencer-octave-control">
          <span id="sequencer-octave-label">Octave</span>
          <div
            aria-labelledby="sequencer-octave-label"
            className="sequencer-octave-options"
            role="radiogroup"
          >
            {SEQUENCER_OCTAVES.map((value) => (
              <label key={value}>
                <input
                  checked={octave === value}
                  name="sequencer-octave"
                  onChange={() => setOctave(value)}
                  type="radio"
                />
                {value}
              </label>
            ))}
          </div>
        </div>
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
            On
          </button>
          <button
            aria-pressed={recording}
            onClick={() => onRecordingChange(!recording)}
            type="button"
          >
            Record
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
