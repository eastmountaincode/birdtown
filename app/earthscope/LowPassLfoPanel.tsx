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
  tempoBpm,
}: {
  cutoff: number;
  onChange: (settings: LowPassLfoSettings) => void;
  settings: LowPassLfoSettings;
  tempoBpm: number;
}) {
  const depthHz = lowPassLfoDepthHz(cutoff, settings.depth);
  const syncedRate = lowPassLfoRateHz(
    {
      ...settings,
      syncEnabled: true,
    },
    tempoBpm,
  );
  const timing = LOW_PASS_LFO_TIMINGS.find(
    (candidate) => candidate.value === settings.timing,
  ) ?? LOW_PASS_LFO_TIMINGS[0];

  return (
    <fieldset className="plain-fieldset low-pass-lfo">
      <legend>LFO</legend>
      <div className="low-pass-lfo__controls">
        <div className="control-row">
          <span id="low-pass-lfo-mode">Mode</span>
          <div
            aria-labelledby="low-pass-lfo-mode"
            className="low-pass-lfo__modes"
            role="radiogroup"
          >
            <label>
              <input
                checked={!settings.syncEnabled}
                name="low-pass-lfo-mode"
                onChange={() =>
                  onChange({
                    ...settings,
                    syncEnabled: false,
                  })
                }
                type="radio"
              />
              Free
            </label>
            <label>
              <input
                checked={settings.syncEnabled}
                name="low-pass-lfo-mode"
                onChange={() =>
                  onChange({
                    ...settings,
                    syncEnabled: true,
                  })
                }
                type="radio"
              />
              Sync
            </label>
          </div>
          <output />
        </div>
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
        {settings.syncEnabled ? (
          <RangeControl
            id="low-pass-lfo-time"
            label="Time"
            max={1}
            min={0}
            onChange={(position) =>
              onChange({
                ...settings,
                timing: positionToLowPassLfoTiming(position).value,
              })
            }
            output={`${timing.label} @ ${tempoBpm} BPM`}
            step={1 / (LOW_PASS_LFO_TIMINGS.length - 1)}
            value={lowPassLfoTimingToPosition(settings.timing)}
            valueText={`${timing.label}, ${syncedRate.toFixed(2)} hertz at ${tempoBpm} beats per minute`}
          />
        ) : (
          <RangeControl
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
        )}
      </div>
    </fieldset>
  );
}
