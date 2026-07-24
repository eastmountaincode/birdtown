"use client";

import { useEffect, useRef } from "react";

interface WaveformCanvasProps {
  label?: string;
  samples: number[];
  selectedSampleCount?: number;
}

export function WaveformCanvas({
  label = "Live waveform",
  samples,
  selectedSampleCount = 0,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext("2d");
      if (!context) return;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);

      if (samples.length < 2) return;

      let mean = 0;
      for (const value of samples) mean += value;
      mean /= samples.length;

      let peak = 1;
      for (const value of samples) peak = Math.max(peak, Math.abs(value - mean));

      const columns = Math.min(width, samples.length);
      const samplesPerColumn = samples.length / columns;
      const amplitude = height * 0.44;
      const selectedCount = Math.max(
        0,
        Math.min(Math.round(selectedSampleCount), samples.length),
      );
      const selectedWidth =
        selectedCount === 0
          ? 0
          : Math.min(
              width,
              Math.max(ratio, (selectedCount / samples.length) * width),
            );
      const selectedX = width - selectedWidth;

      if (selectedWidth > 0) {
        context.fillStyle = "rgba(255, 251, 138, 0.55)";
        context.fillRect(selectedX, 0, selectedWidth, height);
      }

      context.strokeStyle = "#111111";
      context.lineWidth = Math.max(1, ratio);
      context.beginPath();

      for (let column = 0; column < columns; column += 1) {
        const start = Math.floor(column * samplesPerColumn);
        const end = Math.max(
          start + 1,
          Math.floor((column + 1) * samplesPerColumn),
        );
        let low = Infinity;
        let high = -Infinity;

        for (
          let index = start;
          index < end && index < samples.length;
          index += 1
        ) {
          const normalized = (samples[index] - mean) / peak;
          low = Math.min(low, normalized);
          high = Math.max(high, normalized);
        }

        const px =
          columns === 1
            ? width / 2
            : (column / (columns - 1)) * (width - ratio) + ratio / 2;
        context.moveTo(px, height / 2 - high * amplitude);
        context.lineTo(px, height / 2 - low * amplitude);
      }

      context.stroke();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [samples, selectedSampleCount]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={label}
      data-testid="waveform"
      role="img"
    />
  );
}
