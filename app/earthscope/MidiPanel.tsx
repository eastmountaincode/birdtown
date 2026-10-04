import type { MidiInputOption } from "./midi";

export function MidiPanel({
  connect,
  connected,
  connecting,
  disconnect,
  inputs,
  keysEnabled,
  onKeysEnabledChange,
  onInputChange,
  selectedInputKey,
}: {
  connect: () => Promise<void>;
  connected: boolean;
  connecting: boolean;
  disconnect: () => void;
  inputs: MidiInputOption[];
  keysEnabled: boolean;
  onKeysEnabledChange: (enabled: boolean) => void;
  onInputChange: (inputKey: string) => Promise<void>;
  selectedInputKey: string | null;
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
          {connected ? "Disconnect" : connecting ? "Connecting..." : "Connect MIDI"}
        </button>
        <button
          type="button"
          aria-pressed={keysEnabled}
          onClick={() => onKeysEnabledChange(!keysEnabled)}
        >
          Keys {keysEnabled ? "On" : "Off"}
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
      </div>
    </fieldset>
  );
}
