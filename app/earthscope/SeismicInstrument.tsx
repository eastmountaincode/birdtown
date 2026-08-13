"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { SequencerPanel } from "./SequencerPanel";
import { clampTempo, DEFAULT_TEMPO } from "./tempo";
import { useMelodicSequencer } from "./useMelodicSequencer";
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
  const sequencer = useMelodicSequencer(tempoBpm);
  const audio = useSeismicAudio({
    controls,
    gateOpen: voiceGateOpen(latchEnabled, hasHeldMidiKeys),
    lowPassLfo,
    midiOverrideActive: hasHeldMidiKeys,
    sampleRate: signal.sampleRate,
    samples: signal.samples,
    sequence: sequencer.sequence,
    sequenceTransport: sequencer.transport,
    tempoBpm,
  });
  const audioOutput = useAudioOutput(
    audio.setOutputDevice,
    audio.setOutputChannel,
  );
  const setAudioGateOpen = audio.setGateOpen;
  const setMidiOverrideActive = audio.setMidiOverrideActive;
  const changeHeldKeys = useCallback(
    (hasHeldKeys: boolean) => {
      hasHeldMidiKeysRef.current = hasHeldKeys;
      setMidiOverrideActive(hasHeldKeys);
      setAudioGateOpen(
        voiceGateOpen(latchEnabledRef.current, hasHeldKeys),
      );
      setHasHeldMidiKeys(hasHeldKeys);
    },
    [setAudioGateOpen, setMidiOverrideActive],
  );
  const midi = useMidiControls({
    controls,
    onActiveNoteChange: sequencer.setActiveMidiNote,
    onHeldKeysChange: changeHeldKeys,
    setControls,
    setPitchBendRatio: audio.setPitchBendRatio,
    setRepeatsPerSecond: audio.setRepeatsPerSecond,
  });
  const midiClock = useMidiClock({
    access: midi.midiAccess,
    onTransportChange: sequencer.setClockTransport,
    tempoBpm,
  });
  const startMidiClock = midiClock.start;
  const stopMidiClock = midiClock.stop;

  useEffect(() => {
    void startMidiClock();
    return stopMidiClock;
  }, [startMidiClock, stopMidiClock]);

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
          <SequencerPanel
            activeStep={sequencer.activeStep}
            onChange={sequencer.setSequence}
            onRecordingChange={sequencer.setRecording}
            recording={sequencer.recording}
            sequence={sequencer.sequence}
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
            connected={midi.midiAccess !== null}
            error={midiClock.error}
            onOutputChange={midiClock.selectOutput}
            onTempoChange={changeTempo}
            outputs={midiClock.outputs}
            selectedOutputIds={midiClock.selectedOutputIds}
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
