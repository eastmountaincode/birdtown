import { DialControl } from "./DialControl";
import {
  clampLowPassLfo,
  isLowPassLfoTiming,
  lowPassLfoDepthHz,
  lowPassLfoRateHz,
  lowPassLfoRateToPosition,
  lowPassLfoTempoToPosition,
  LOW_PASS_LFO_TIMINGS,
  positionToLowPassLfoRate,
  positionToLowPassLfoTempo,
  type LowPassLfoSettings,
} from "./lowPassLfo";

function formatRate(rate: number) {
  return rate < 0.1 ? rate.toFixed(3) : rate.toFixed(2);
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
  const synced = settings.timing !== "free";
  const effectiveRate = lowPassLfoRateHz(settings);
  const ratePosition = synced
    ? lowPassLfoTempoToPosition(settings.tempoBpm)
    : lowPassLfoRateToPosition(settings.rate);
  const rateOutput = synced
    ? `${Math.round(settings.tempoBpm)} bpm`
    : `${formatRate(settings.rate)} Hz`;

  return (
    <fieldset className="low-pass-lfo">
      <legend>LFO</legend>
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
          id="low-pass-lfo-rate"
          label={synced ? "BPM" : "Rate"}
          onChange={(position) =>
            onChange(
              synced
                ? {
                    ...settings,
                    tempoBpm: positionToLowPassLfoTempo(position),
                  }
                : {
                    ...settings,
                    rate: positionToLowPassLfoRate(position),
                  },
            )
          }
          output={rateOutput}
          position={ratePosition}
          valueText={
            synced
              ? `${Math.round(settings.tempoBpm)} beats per minute, ${formatRate(effectiveRate)} hertz`
              : `${formatRate(settings.rate)} hertz`
          }
        />
        <label className="low-pass-lfo__timing">
          <span>Sync</span>
          <select
            onChange={(event) => {
              if (!isLowPassLfoTiming(event.target.value)) return;
              onChange({
                ...settings,
                timing: event.target.value,
              });
            }}
            value={settings.timing}
          >
            {LOW_PASS_LFO_TIMINGS.map((timing) => (
              <option key={timing.value} value={timing.value}>
                {timing.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
