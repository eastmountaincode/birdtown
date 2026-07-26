import { AudioOutputControl } from "./AudioOutputControl";
import type { AudioOutputDevice } from "./audioOutput";

export function SettingsPanel({
  audioOutput,
  latchEnabled,
  onLatchChange,
}: {
  audioOutput: {
    choose: () => Promise<void>;
    choosing: boolean;
    error: string | null;
    outputs: AudioOutputDevice[];
    select: (deviceId: string) => Promise<void>;
    selected: AudioOutputDevice;
    supported: boolean;
  };
  latchEnabled: boolean;
  onLatchChange: (enabled: boolean) => void;
}) {
  return (
    <fieldset className="plain-fieldset">
      <legend>Settings</legend>
      <label className="settings-toggle">
        <input
          checked={latchEnabled}
          onChange={(event) => onLatchChange(event.target.checked)}
          type="checkbox"
        />
        <span>{latchEnabled ? "Latch on" : "Latch off"}</span>
      </label>
      <AudioOutputControl
        choose={audioOutput.choose}
        choosing={audioOutput.choosing}
        error={audioOutput.error}
        onChange={audioOutput.select}
        outputs={audioOutput.outputs}
        selected={audioOutput.selected}
        supported={audioOutput.supported}
      />
    </fieldset>
  );
}
