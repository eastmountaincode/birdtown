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
import { ClockPanel } from "./ClockPanel";
import { InstrumentControls } from "./InstrumentControls";
import {
  DEFAULT_LOW_PASS_LFO,
  type LowPassLfoSettings,
} from "./lowPassLfo";
import { LowPassLfoPanel } from "./LowPassLfoPanel";
import { MidiPanel } from "./MidiPanel";
import { SettingsPanel } from "./SettingsPanel";
import { clampTempo, DEFAULT_TEMPO } from "./tempo";
import { useMidiClock } from "./useMidiClock";
import { useMidiControls } from "./useMidiControls";
import { useSeismicAudio } from "./useSeismicAudio";
import { voiceGateOpen } from "./voiceGate";
import { WaveformPanel } from "./WaveformPanel";
import { useAudioOutput } from "./useAudioOutput";

const SUPPORT_URL = "https://ko-fi.com/I3I332AJE";

export function SeismicInstrument() {
  const signal = useEarthScope();
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [hasHeldMidiKeys, setHasHeldMidiKeys] = useState(false);
  const hasHeldMidiKeysRef = useRef(false);
  const [latchEnabled, setLatchEnabled] = useState(true);
  const latchEnabledRef = useRef(true);
  const [lowPassLfo, setLowPassLfo] = useState(DEFAULT_LOW_PASS_LFO);
  const [tempoBpm, setTempoBpm] = useState(DEFAULT_TEMPO);
  const audio = useSeismicAudio({
    controls,
    gateOpen: voiceGateOpen(latchEnabled, hasHeldMidiKeys),
    lowPassLfo,
    sampleRate: signal.sampleRate,
    samples: signal.samples,
    tempoBpm,
  });
  const audioOutput = useAudioOutput(audio.setOutputDevice);
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
    setPitchBendRatio: audio.setPitchBendRatio,
    setRepeatsPerSecond: audio.setRepeatsPerSecond,
  });
  const midiClock = useMidiClock({
    access: midi.midiAccess,
    tempoBpm,
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
  const changeLowPassLfo = (settings: LowPassLfoSettings) => {
    setLowPassLfo(settings);
  };
  const changeTempo = useCallback((tempoBpm: number) => {
    setTempoBpm(clampTempo(tempoBpm));
  }, []);

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
          <LowPassLfoPanel
            cutoff={controls.cutoff}
            onChange={changeLowPassLfo}
            settings={lowPassLfo}
            tempoBpm={tempoBpm}
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
          <ClockPanel
            canStart={midiClock.canStart}
            connected={midi.midiAccess !== null}
            error={midiClock.error}
            onOutputChange={midiClock.selectOutput}
            onStart={midiClock.start}
            onStop={midiClock.stop}
            onTempoChange={changeTempo}
            outputs={midiClock.outputs}
            running={midiClock.running}
            selectedOutputIds={midiClock.selectedOutputIds}
            starting={midiClock.starting}
            tempoBpm={tempoBpm}
          />
          <SettingsPanel
            audioOutput={audioOutput}
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
