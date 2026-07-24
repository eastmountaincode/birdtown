import { EARTHSCOPE_EXPECTED_SAMPLE_RATE } from "../lib/earthScopeConfig";
import {
  CONTROL_SPECS,
  effectiveLoopSampleCount,
  type VoiceControlKey,
  type VoiceControls,
} from "./controls";
import { RangeControl } from "./RangeControl";
import { RepeatRateControl } from "./RepeatRateControl";
import { SampleCountControl } from "./SampleCountControl";

export function InstrumentControls({
  availableSamples,
  controls,
  onChange,
  sampleRate,
}: {
  availableSamples: number;
  controls: VoiceControls;
  onChange: (key: VoiceControlKey, value: number) => void;
  sampleRate: number;
}) {
  const rate =
    sampleRate > 0 ? sampleRate : EARTHSCOPE_EXPECTED_SAMPLE_RATE;
  const samplesInUse = effectiveLoopSampleCount(
    controls.sampleCount,
    availableSamples,
  );
  const sampleOutput =
    samplesInUse < controls.sampleCount
      ? `${samplesInUse} of ${controls.sampleCount} samples`
      : `${samplesInUse} samples (${(samplesInUse / rate).toFixed(2)} s)`;

  return (
    <fieldset className="plain-fieldset">
      <legend>Controls</legend>
      <div className="control-list">
        <SampleCountControl
          id="sample-count"
          onChange={(value) => onChange("sampleCount", value)}
          output={sampleOutput}
          value={controls.sampleCount}
        />
        <RepeatRateControl
          id="repeat-rate"
          onChange={(value) =>
            onChange("repeatsPerSecond", value)
          }
          value={controls.repeatsPerSecond}
        />
        <RangeControl
          id="cutoff"
          label="Low-pass"
          max={CONTROL_SPECS.cutoff.max}
          min={CONTROL_SPECS.cutoff.min}
          onChange={(value) => onChange("cutoff", value)}
          output={`${controls.cutoff} Hz`}
          step={CONTROL_SPECS.cutoff.step}
          value={controls.cutoff}
        />
        <RangeControl
          id="resonance"
          label="Resonance"
          max={CONTROL_SPECS.resonance.max}
          min={CONTROL_SPECS.resonance.min}
          onChange={(value) => onChange("resonance", value)}
          output={controls.resonance.toFixed(1)}
          step={CONTROL_SPECS.resonance.step}
          value={controls.resonance}
        />
        <RangeControl
          id="volume"
          label="Volume"
          max={CONTROL_SPECS.volume.max}
          min={CONTROL_SPECS.volume.min}
          onChange={(value) => onChange("volume", value)}
          output={`${Math.round(controls.volume * 100)}%`}
          step={CONTROL_SPECS.volume.step}
          value={controls.volume}
        />
      </div>
    </fieldset>
  );
}
