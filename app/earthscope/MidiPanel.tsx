import type { MidiInputOption, MidiKnobMode } from "./midi";

export function MidiPanel({
  connect,
  connected,
  connecting,
  disconnect,
  inputs,
  knobMode,
  onInputChange,
  onKnobModeChange,
  selectedInputKey,
  status,
}: {
  connect: () => Promise<void>;
  connected: boolean;
  connecting: boolean;
  disconnect: () => void;
  inputs: MidiInputOption[];
  knobMode: MidiKnobMode;
  onInputChange: (inputKey: string) => Promise<void>;
  onKnobModeChange: (mode: MidiKnobMode) => void;
  selectedInputKey: string | null;
  status: string;
}) {
  return (
    <fieldset className="plain-fieldset">
      <legend>MIDI</legend>
      <div className="midi-controls">
        <button
          disabled={connecting}
          onClick={() => (connected ? disconnect() : void connect())}
          type="button"
        >
          {connected ? "Disconnect" : connecting ? "Connecting..." : "Connect MPK mini"}
        </button>
        {connected ? (
          <>
            <label htmlFor="midi-input">Input</label>
            <select
              disabled={inputs.length === 0}
              id="midi-input"
              onChange={(event) => void onInputChange(event.target.value)}
              value={selectedInputKey ?? ""}
            >
              {selectedInputKey === null ? (
                <option value="">
                  {inputs.length > 0 ? "Choose input" : "No MIDI inputs"}
                </option>
              ) : null}
              {inputs.map((input) => (
                <option key={input.id} value={input.id}>
                  {input.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <label htmlFor="midi-knob-mode">Knob mode</label>
        <select
          id="midi-knob-mode"
          onChange={(event) =>
            onKnobModeChange(event.target.value as MidiKnobMode)
          }
          value={knobMode}
        >
          <option value="relative">Relative</option>
          <option value="absolute">Absolute</option>
        </select>
      </div>
      <p aria-live="polite" className="midi-status">
        {status}
      </p>
    </fieldset>
  );
}
