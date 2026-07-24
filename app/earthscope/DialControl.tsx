import {
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface DialControlProps {
  id: string;
  label: string;
  onChange: (position: number) => void;
  output: string;
  position: number;
  valueText: string;
}

function clampPosition(position: number) {
  const finitePosition = Number.isFinite(position) ? position : 0;
  return Math.min(1, Math.max(0, finitePosition));
}

export function DialControl({
  id,
  label,
  onChange,
  output,
  position,
  valueText,
}: DialControlProps) {
  const dragRef = useRef<{
    pointerId: number;
    position: number;
    y: number;
  } | null>(null);
  const clampedPosition = clampPosition(position);
  const style = {
    "--dial-angle": `${-135 + clampedPosition * 270}deg`,
  } as CSSProperties;

  const finishDrag = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <label className="dial-control" htmlFor={id}>
      <span>{label}</span>
      <span className="dial-control__dial" style={style}>
        <input
          aria-valuetext={valueText}
          id={id}
          max="1"
          min="0"
          onChange={(event) =>
            onChange(clampPosition(Number(event.target.value)))
          }
          onPointerCancel={finishDrag}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              pointerId: event.pointerId,
              position: clampedPosition,
              y: event.clientY,
            };
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            onChange(clampPosition(drag.position + (drag.y - event.clientY) / 120));
          }}
          onPointerUp={finishDrag}
          step="any"
          type="range"
          value={clampedPosition}
        />
        <span aria-hidden="true" className="dial-control__face">
          <span className="dial-control__indicator" />
        </span>
      </span>
      <output htmlFor={id}>{output}</output>
    </label>
  );
}
