import type {
  AudioOutputChannel,
  AudioOutputDevice,
} from "./audioOutput";

export function AudioOutputControl({
  choose,
  channel,
  choosing,
  error,
  onChange,
  onChannelChange,
  outputs,
  selected,
  supported,
}: {
  choose: () => Promise<void>;
  channel: AudioOutputChannel;
  choosing: boolean;
  error: string | null;
  onChange: (deviceId: string) => Promise<void>;
  onChannelChange: (channel: AudioOutputChannel) => Promise<void>;
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
      <div className="audio-output-channel-control">
        <label htmlFor="audio-output-channel">Output channel</label>
        <select
          id="audio-output-channel"
          onChange={(event) =>
            void onChannelChange(event.target.value as AudioOutputChannel)
          }
          value={channel}
        >
          <option value="stereo">Stereo</option>
          <option value="left">Channel 1</option>
          <option value="right">Channel 2</option>
        </select>
      </div>
      {error ? (
        <p className="audio-output-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
