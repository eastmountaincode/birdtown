import { useState } from "react";
import {
  clearSequence,
  SEQUENCE_LENGTHS,
  SEQUENCER_OCTAVES,
  sequencerNoteName,
  sequencerNotesForOctave,
  setSequenceLength,
  toggleSequenceNote,
  type MelodicSequence,
  type SequencerOctave,
} from "./sequencer";

export function SequencerPanel({
  activeStep,
  onChange,
  sequence,
}: {
  activeStep: number | null;
  onChange: (sequence: MelodicSequence) => void;
  sequence: MelodicSequence;
}) {
  const [octave, setOctave] = useState<SequencerOctave>(2);
  const visibleNotes = sequencerNotesForOctave(octave);

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
                    onChange(setSequenceLength(sequence, length))
                  }
                  type="radio"
                />
                {length}
              </label>
            ))}
          </div>
        </div>
        <label className="sequencer-octave-control">
          Octave
          <input
            aria-valuetext={`Octave ${octave}`}
            max={SEQUENCER_OCTAVES.at(-1)}
            min={SEQUENCER_OCTAVES[0]}
            onChange={(event) =>
              setOctave(Number(event.target.value) as SequencerOctave)
            }
            step={1}
            type="range"
            value={octave}
          />
          <output>{octave}</output>
        </label>
        <button
          disabled={!sequence.notes.some((note) => note !== null)}
          onClick={() => onChange(clearSequence(sequence))}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="sequencer-grid-wrap">
        <table className="sequencer-grid">
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
                          onClick={() =>
                            onChange(toggleSequenceNote(sequence, step, note))
                          }
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
