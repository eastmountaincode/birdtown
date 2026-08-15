import type {
  ClockSource,
  MidiClockInputOption,
  MidiClockOutputOption,
} from "./midiClock";
import type { ExternalClockStatus } from "./useMidiClockInput";
import { RangeControl } from "./RangeControl";
import { TEMPO_MAX, TEMPO_MIN } from "./tempo";

export function ClockPanel({
  connected,
  error,
  externalStatus,
  inputs,
  onInputChange,
  onOutputChange,
  onSourceChange,
  onStart,
  onStop,
  onTempoChange,
  onThruChange,
  outputs,
  running,
  selectedInputId,
  selectedOutputIds,
  source,
  starting,
  tempoBpm,
  tempoOutput,
  thruEnabled,
}: {
  connected: boolean;
  error: string | null;
  externalStatus: ExternalClockStatus;
  inputs: MidiClockInputOption[];
  onInputChange: (inputId: string) => void;
  onOutputChange: (outputId: string, selected: boolean) => void;
  onSourceChange: (source: ClockSource) => void;
  onStart: () => Promise<void>;
  onStop: () => void;
  onTempoChange: (tempoBpm: number) => void;
  onThruChange: (enabled: boolean) => void;
  outputs: MidiClockOutputOption[];
  running: boolean;
  selectedInputId: string | null;
  selectedOutputIds: string[];
  source: ClockSource;
  starting: boolean;
  tempoBpm: number;
  tempoOutput: string;
  thruEnabled: boolean;
}) {
  const selected = new Set(selectedOutputIds);

  return (
    <fieldset className="plain-fieldset">
      <legend>Clock</legend>
      <div className="control-list">
        <div className="clock-output-row">
          <span id="clock-source-label">Source</span>
          <div
            aria-labelledby="clock-source-label"
            className="clock-output-options"
            role="radiogroup"
          >
            <label className="clock-output-option">
              <input
                checked={source === "internal"}
                name="clock-source"
                onChange={() => onSourceChange("internal")}
                type="radio"
              />
              Internal
            </label>
            <label className="clock-output-option">
              <input
                checked={source === "midi"}
                name="clock-source"
                onChange={() => onSourceChange("midi")}
                type="radio"
              />
              MIDI
            </label>
          </div>
        </div>
        <RangeControl
          disabled={source === "midi"}
          id="clock-tempo"
          label="Tempo"
          max={TEMPO_MAX}
          min={TEMPO_MIN}
          onChange={onTempoChange}
          output={tempoOutput}
          step={1}
          value={tempoBpm}
          valueText={tempoOutput}
        />
        {source === "midi" ? (
          <div className="clock-output-row">
            <label htmlFor="clock-input">Input</label>
            <select
              disabled={!connected || inputs.length === 0}
              id="clock-input"
              onChange={(event) => onInputChange(event.target.value)}
              value={selectedInputId ?? ""}
            >
              {selectedInputId === null ? (
                <option value="">
                  {!connected
                    ? "MIDI disconnected"
                    : inputs.length > 0
                      ? "Input disconnected"
                      : "No MIDI inputs"}
                </option>
              ) : null}
              {inputs.map((input) => (
                <option key={input.id} value={input.id}>
                  {input.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="clock-output-row">
          <span>Transport</span>
          <div className="clock-transport">
            {source === "midi" ? <span>{externalStatus}</span> : null}
            <button
              disabled={
                starting ||
                (source === "midi" &&
                  (!connected || selectedInputId === null))
              }
              onClick={() => {
                if (running) {
                  onStop();
                } else {
                  void onStart();
                }
              }}
              type="button"
            >
              {starting ? "Starting…" : running ? "Stop" : "Start"}
            </button>
          </div>
        </div>
        {source === "midi" ? (
          <div className="clock-output-row">
            <span>Thru</span>
            <label className="clock-output-option">
              <input
                checked={thruEnabled}
                onChange={(event) => onThruChange(event.target.checked)}
                type="checkbox"
              />
              Send to outputs
            </label>
          </div>
        ) : null}
        <div className="clock-output-row">
          <span id="clock-output-label">
            {source === "midi" ? "Thru outputs" : "Outputs"}
          </span>
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
