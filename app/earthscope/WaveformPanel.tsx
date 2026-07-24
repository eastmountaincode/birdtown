import { WaveformCanvas } from "../components/WaveformCanvas";
import { EARTHSCOPE_WINDOW_SECONDS } from "../lib/earthScopeConfig";
import { recent } from "./signal";

export function WaveformPanel({
  sampleCount,
  sampleRate,
  samples,
  status,
}: {
  sampleCount: number;
  sampleRate: number;
  samples: number[];
  status: string;
}) {
  const values = recent(samples, sampleRate, EARTHSCOPE_WINDOW_SECONDS);

  return (
    <figure className="instrument-trace">
      {values.length > 0 ? (
        <WaveformCanvas
          label="EarthScope waveform with the sounding region highlighted"
          samples={values}
          selectedSampleCount={sampleCount}
        />
      ) : (
        <span>{status === "connecting" ? "..." : status}</span>
      )}
    </figure>
  );
}
