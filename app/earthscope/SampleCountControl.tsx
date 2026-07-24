import {
  positionToSampleCount,
  sampleCountToPosition,
} from "./sampleCountScale";

interface SampleCountControlProps {
  id: string;
  onChange: (value: number) => void;
  output: string;
  value: number;
}

export function SampleCountControl({
  id,
  onChange,
  output,
  value,
}: SampleCountControlProps) {
  return (
    <label className="control-row" htmlFor={id}>
      <span>Samples in loop</span>
      <input
        aria-valuetext={`${value} samples`}
        id={id}
        max={1}
        min={0}
        onChange={(event) =>
          onChange(positionToSampleCount(Number(event.target.value)))
        }
        step="any"
        type="range"
        value={sampleCountToPosition(value)}
      />
      <output htmlFor={id}>{output}</output>
    </label>
  );
}
