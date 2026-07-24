import { DialControl } from "./DialControl";
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
    <fieldset className="low-pass-lfo">
      <legend>
        LFO
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
      </legend>
      <div className="low-pass-lfo__controls">
        <DialControl
          id="low-pass-lfo-depth"
          label="Depth"
          onChange={(position) =>
            onChange({
              ...settings,
              depth: clampLowPassLfo("depth", position),
            })
          }
          output={`±${Math.round(depthHz)} Hz`}
          position={settings.depth}
          valueText={`${Math.round(depthHz)} hertz above and below`}
        />
        <DialControl
          id="low-pass-lfo-time"
          label="Time"
          onChange={(position) =>
            onChange({
              ...settings,
              rate: positionToLowPassLfoTimeRate(position),
            })
          }
          output={formatTime(settings.rate)}
          position={lowPassLfoTimeToPosition(settings.rate)}
          valueText={`${formatTime(settings.rate)} per cycle`}
        />
        <DialControl
          id="low-pass-lfo-division"
          label="Division"
          onChange={(position) =>
            onChange({
              ...settings,
              timing: positionToLowPassLfoTiming(position).value,
            })
          }
          output={timing.label}
          position={lowPassLfoTimingToPosition(settings.timing)}
          step={1 / (LOW_PASS_LFO_TIMINGS.length - 1)}
          valueText={`${timing.label}, ${syncedRate.toFixed(2)} hertz at ${Math.round(settings.tempoBpm)} beats per minute`}
        />
      </div>
    </fieldset>
  );
}
