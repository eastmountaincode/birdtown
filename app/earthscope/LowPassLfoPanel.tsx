import {
  clampLowPassLfo,
  lowPassLfoDepthHz,
  lowPassLfoRateHz,
  lowPassLfoTimeToPosition,
  lowPassLfoTimingToPosition,
  LOW_PASS_LFO_TIMINGS,
  positionToLowPassLfoTimeRate,
  positionToLowPassLfoTiming,
  type LowPassLfoSettings,
} from "./lowPassLfo";
import { RangeControl } from "./RangeControl";

function formatTime(rate: number) {
  const seconds = 1 / rate;
  return seconds >= 10 ? `${seconds.toFixed(1)} s` : `${seconds.toFixed(2)} s`;
}

export function LowPassLfoPanel({
  cutoff,
  onChange,
  settings,
}: {
  cutoff: number;
  onChange: (settings: LowPassLfoSettings) => void;
  settings: LowPassLfoSettings;
}) {
  const depthHz = lowPassLfoDepthHz(cutoff, settings.depth);
  const syncedRate = lowPassLfoRateHz({
    ...settings,
    syncEnabled: true,
  });
  const timing = LOW_PASS_LFO_TIMINGS.find(
    (candidate) => candidate.value === settings.timing,
  ) ?? LOW_PASS_LFO_TIMINGS[0];

  return (
    <fieldset className="plain-fieldset low-pass-lfo">
      <legend>LFO</legend>
      <div className="low-pass-lfo__controls">
        <label className="low-pass-lfo__sync">
          <input
            checked={settings.syncEnabled}
            onChange={(event) =>
              onChange({
                ...settings,
                syncEnabled: event.target.checked,
              })
            }
            type="checkbox"
          />
          Sync
        </label>
        <RangeControl
          id="low-pass-lfo-depth"
          label="Depth"
          max={1}
          min={0}
          onChange={(value) =>
            onChange({
              ...settings,
              depth: clampLowPassLfo("depth", value),
            })
          }
          output={`±${Math.round(depthHz)} Hz`}
          step={0.01}
          value={settings.depth}
          valueText={`${Math.round(depthHz)} hertz above and below`}
        />
        <RangeControl
          disabled={settings.syncEnabled}
          id="low-pass-lfo-time"
          label="Time"
          max={1}
          min={0}
          onChange={(position) =>
            onChange({
              ...settings,
              rate: positionToLowPassLfoTimeRate(position),
            })
          }
          output={formatTime(settings.rate)}
          step={0.01}
          value={lowPassLfoTimeToPosition(settings.rate)}
          valueText={`${formatTime(settings.rate)} per cycle`}
        />
        <RangeControl
          disabled={!settings.syncEnabled}
          id="low-pass-lfo-division"
          label="Division"
          max={1}
          min={0}
          onChange={(position) =>
            onChange({
              ...settings,
              timing: positionToLowPassLfoTiming(position).value,
            })
          }
          output={timing.label}
          step={1 / (LOW_PASS_LFO_TIMINGS.length - 1)}
          value={lowPassLfoTimingToPosition(settings.timing)}
          valueText={`${timing.label}, ${syncedRate.toFixed(2)} hertz at ${Math.round(settings.tempoBpm)} beats per minute`}
        />
      </div>
    </fieldset>
  );
}
