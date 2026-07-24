"use client";

import { useCallback, useRef, useState } from "react";
import { EARTHSCOPE_STATION } from "../lib/earthScopeConfig";
import { useEarthScope } from "../lib/useDataLink";
import {
  clampControl,
  DEFAULT_CONTROLS,
  type VoiceControlKey,
} from "./controls";
import { AboutDialog } from "./AboutDialog";
import { InstrumentControls } from "./InstrumentControls";
import { MidiPanel } from "./MidiPanel";
import { SettingsPanel } from "./SettingsPanel";
import { useMidiControls } from "./useMidiControls";
import { useSeismicAudio } from "./useSeismicAudio";
import { voiceGateOpen } from "./voiceGate";
import { WaveformPanel } from "./WaveformPanel";

const SUPPORT_URL = "https://ko-fi.com/I3I332AJE";

export function SeismicInstrument() {
  const signal = useEarthScope();
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [hasHeldMidiKeys, setHasHeldMidiKeys] = useState(false);
  const hasHeldMidiKeysRef = useRef(false);
  const [latchEnabled, setLatchEnabled] = useState(true);
  const latchEnabledRef = useRef(true);
  const audio = useSeismicAudio({
    controls,
    gateOpen: voiceGateOpen(latchEnabled, hasHeldMidiKeys),
    sampleRate: signal.sampleRate,
    samples: signal.samples,
  });
  const setAudioGateOpen = audio.setGateOpen;
  const changeHeldKeys = useCallback(
    (hasHeldKeys: boolean) => {
      hasHeldMidiKeysRef.current = hasHeldKeys;
      setAudioGateOpen(
        voiceGateOpen(latchEnabledRef.current, hasHeldKeys),
      );
      setHasHeldMidiKeys(hasHeldKeys);
    },
    [setAudioGateOpen],
  );
  const midi = useMidiControls({
    controls,
    onHeldKeysChange: changeHeldKeys,
    setControls,
    setRepeatsPerSecond: audio.setRepeatsPerSecond,
  });

  const changeControl = useCallback(
    (key: VoiceControlKey, value: number) => {
      setControls((current) => ({
        ...current,
        [key]: clampControl(key, value),
      }));
    },
    [],
  );
  const changeLatch = useCallback(
    (enabled: boolean) => {
      latchEnabledRef.current = enabled;
      setAudioGateOpen(
        voiceGateOpen(enabled, hasHeldMidiKeysRef.current),
      );
      setLatchEnabled(enabled);
    },
    [setAudioGateOpen],
  );

  return (
    <main>
      <section className="page-shell">
        <div className="instrument-toolbar">
          <p className="instrument-status">
            {EARTHSCOPE_STATION}
            {signal.latency === null
              ? null
              : ` +++ latency: ${signal.latency.toFixed(1)}s`}
          </p>
          <div className="instrument-actions">
            <label className="output-meter">
              output
              <meter aria-label="Output level" max="1" min="0" value={audio.level} />
            </label>
            <button
              aria-pressed={audio.playing}
              disabled={!audio.canPlay}
              onClick={() => void audio.togglePlayback()}
              type="button"
            >
              {audio.playing ? "Stop" : "Play"}
            </button>
          </div>
        </div>
        {audio.error ? (
          <p className="instrument-error" role="alert">
            {audio.error}
          </p>
        ) : null}

        <WaveformPanel
          sampleCount={controls.sampleCount}
          sampleRate={signal.sampleRate}
          samples={signal.samples}
          status={signal.status}
        />

        <div className="instrument-panels">
          <InstrumentControls
            availableSamples={signal.samples.length}
            controls={controls}
            onChange={changeControl}
            sampleRate={signal.sampleRate}
          />
          <MidiPanel
            connect={midi.connect}
            connected={midi.connected}
            connecting={midi.connecting}
            disconnect={midi.disconnect}
            inputs={midi.inputs}
            onInputChange={midi.selectInput}
            selectedInputKey={midi.selectedInputKey}
          />
          <SettingsPanel
            latchEnabled={latchEnabled}
            onLatchChange={changeLatch}
          />
        </div>
        <footer className="site-footer">
          <h1 className="site-footer__title">“Birdtown”</h1>
          <div className="site-footer__actions">
            <AboutDialog />
            <a
              className="support-link"
              href={SUPPORT_URL}
              rel="noreferrer"
              target="_blank"
            >
              Support
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}
