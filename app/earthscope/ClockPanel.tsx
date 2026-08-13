import type { MidiClockOutputOption } from "./midiClock";
import { RangeControl } from "./RangeControl";
import { TEMPO_MAX, TEMPO_MIN } from "./tempo";

export function ClockPanel({
  connected,
  error,
  onOutputChange,
  onTempoChange,
  outputs,
  selectedOutputIds,
  tempoBpm,
}: {
  connected: boolean;
  error: string | null;
  onOutputChange: (outputId: string, selected: boolean) => void;
  onTempoChange: (tempoBpm: number) => void;
  outputs: MidiClockOutputOption[];
  selectedOutputIds: string[];
  tempoBpm: number;
}) {
  const selected = new Set(selectedOutputIds);

  return (
    <fieldset className="plain-fieldset">
      <legend>Clock</legend>
      <div className="control-list">
        <RangeControl
          id="clock-tempo"
          label="Tempo"
          max={TEMPO_MAX}
          min={TEMPO_MIN}
          onChange={onTempoChange}
          output={`${tempoBpm} BPM`}
          step={1}
          value={tempoBpm}
          valueText={`${tempoBpm} beats per minute`}
        />
        <div className="clock-output-row">
          <span id="clock-output-label">Outputs</span>
          <div
            aria-labelledby="clock-output-label"
            className="clock-output-options"
            role="group"
          >
            {!connected ? (
              <span>MIDI disconnected</span>
            ) : outputs.length === 0 ? (
              <span>No MIDI outputs</span>
            ) : (
              outputs.map((output) => (
                <label className="clock-output-option" key={output.id}>
                  <input
                    checked={selected.has(output.id)}
                    onChange={(event) =>
                      onOutputChange(output.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  {output.name}
                  {output.available ? null : " (disconnected)"}
                </label>
              ))
            )}
          </div>
        </div>
        {error ? (
          <p className="clock-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
