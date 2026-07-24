export function SettingsPanel({
  latchEnabled,
  onLatchChange,
}: {
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
    </fieldset>
  );
}
