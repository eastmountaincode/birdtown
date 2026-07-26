import type { AudioOutputDevice } from "./audioOutput";

export function AudioOutputControl({
  choose,
  choosing,
  error,
  onChange,
  outputs,
  selected,
  supported,
}: {
  choose: () => Promise<void>;
  choosing: boolean;
  error: string | null;
  onChange: (deviceId: string) => Promise<void>;
  outputs: AudioOutputDevice[];
  selected: AudioOutputDevice;
  supported: boolean;
}) {
  if (!supported) return null;

  return (
    <>
      <div className="audio-output-control">
        <label htmlFor="audio-output">Audio output</label>
        <select
          id="audio-output"
          onChange={(event) => void onChange(event.target.value)}
          value={selected.deviceId}
        >
          {outputs.map((output) => (
            <option key={output.deviceId || "default"} value={output.deviceId}>
              {output.label}
            </option>
          ))}
        </select>
        <button
          disabled={choosing}
          onClick={() => void choose()}
          type="button"
        >
          {choosing ? "Choosing…" : "Choose…"}
        </button>
      </div>
      {error ? (
        <p className="audio-output-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
