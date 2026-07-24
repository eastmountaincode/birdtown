import {
  positionToRepeatRate,
  repeatRateToPosition,
} from "./repeatRateScale";

function formatRate(rate: number) {
  return rate < 0.1 ? rate.toFixed(3) : rate.toFixed(2);
}

export function RepeatRateControl({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="control-row" htmlFor={id}>
      <span>Repeats per second</span>
      <input
        aria-valuetext={`${formatRate(value)} repeats per second`}
        id={id}
        max="1"
        min="0"
        onChange={(event) =>
          onChange(positionToRepeatRate(Number(event.target.value)))
        }
        step="any"
        type="range"
        value={repeatRateToPosition(value)}
      />
      <output htmlFor={id}>{formatRate(value)} / s</output>
    </label>
  );
}
