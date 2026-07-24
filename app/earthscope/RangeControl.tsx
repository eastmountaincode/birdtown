interface RangeControlProps {
  disabled?: boolean;
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  output: string;
  step: number | "any";
  value: number;
  valueText?: string;
}

export function RangeControl({
  disabled = false,
  id,
  label,
  max,
  min,
  onChange,
  output,
  step,
  value,
  valueText,
}: RangeControlProps) {
  return (
    <label className="control-row" htmlFor={id}>
      <span>{label}</span>
      <input
        aria-valuetext={valueText}
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <output htmlFor={id}>{output}</output>
    </label>
  );
}
