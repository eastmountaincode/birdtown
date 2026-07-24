interface RangeControlProps {
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  output: string;
  step: number | "any";
  value: number;
}

export function RangeControl({
  id,
  label,
  max,
  min,
  onChange,
  output,
  step,
  value,
}: RangeControlProps) {
  return (
    <label className="control-row" htmlFor={id}>
      <span>{label}</span>
      <input
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
