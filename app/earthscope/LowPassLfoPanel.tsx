import {
  lowPassLfoDepthHz,
  lowPassLfoRateToPosition,
  positionToLowPassLfoRate,
  type LowPassLfoKey,
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
  onChange: (key: LowPassLfoKey, value: number) => void;
  settings: LowPassLfoSettings;
}) {
  const depthHz = lowPassLfoDepthHz(cutoff, settings.depth);

  return (
    <fieldset className="plain-fieldset lfo-panel">
      <legend>Low-pass LFO</legend>
      <div className="lfo-controls">
        <label className="lfo-control" htmlFor="low-pass-lfo-depth">
          <span>Depth</span>
          <input
            aria-valuetext={`${Math.round(depthHz)} hertz above and below`}
            id="low-pass-lfo-depth"
            max="1"
            min="0"
            onChange={(event) =>
              onChange("depth", Number(event.target.value))
            }
            step="0.01"
            type="range"
            value={settings.depth}
          />
          <output htmlFor="low-pass-lfo-depth">
            ±{Math.round(depthHz)} Hz
          </output>
        </label>
        <label className="lfo-control" htmlFor="low-pass-lfo-rate">
          <span>Rate</span>
          <input
            aria-valuetext={`${formatRate(settings.rate)} hertz`}
            id="low-pass-lfo-rate"
            max="1"
            min="0"
            onChange={(event) =>
              onChange(
                "rate",
                positionToLowPassLfoRate(Number(event.target.value)),
              )
            }
            step="any"
            type="range"
            value={lowPassLfoRateToPosition(settings.rate)}
          />
          <output htmlFor="low-pass-lfo-rate">
            {formatRate(settings.rate)} Hz
          </output>
        </label>
      </div>
    </fieldset>
  );
}
