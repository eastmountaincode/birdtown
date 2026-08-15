<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Birdtown

## Purpose

A browser bass voice whose only audible source is a controllable-length loop from the live EarthScope waveform at `CO.BIRD.00.HHZ` at 100 Hz. The user controls both samples per loop and repeats per second. Birdtown can play live, follow an external sequencer, or use its minimal internal melodic sequencer.

## Constraints

- The audible source material must come from the live seismic waveform. It must not trigger an unrelated synthesizer or sample.
- While playback is active, incoming EarthScope packets must refresh the sounding loop. Playback must never silently freeze a snapshot of the stream.
- DataLink miniSEED samples are raw digitizer counts unless instrument-response metadata is fetched and applied. Do not label them calibrated velocity.
- Keep this single-channel instrument mono.
- Use the keyed external store in `app/lib/useDataLink.ts` so the rolling buffer survives route changes.
- Keep the rolling-window duration and maximum sample count centralized in `app/lib/earthScopeConfig.ts`.
- Keep MPK mini IV knob controls fixed at CC24–27. Do not reintroduce a learn-by-moving-each-knob flow.
- Treat the MPK mini IV MIDI and DAW ports as one logical controller and listen to both at once. Keep every other browser-visible MIDI input separately selectable. Preserve an explicit selection by stable port fingerprint across CoreMIDI re-enumeration.
- Keep `MIDIAccess` alive across device changes, rescan on topology changes, and distinguish an open port from one that has actually delivered knob data.
- Relative MIDI should follow each control's perceptual scale. Sample count and repeat rate use fine logarithmic movement; cutoff, resonance, and volume use the fixed additive steps in `app/earthscope/controls.ts`.
- Latch defaults on. When latch is off, playable MIDI keys gate the output without stopping the live seismic loop, EarthScope updates, or MIDI connections.
- Keep the clock stopped when Birdtown opens. Start and Stop control the selected clock source explicitly; Sequencer On only controls whether the pattern drives the voice.
- Keep the internal sequencer monophonic. MIDI recording and pointer painting may replace the note in a step, but must not introduce a second audio voice or non-seismic sound source.
- Keep the interface close to the semantic, native-control style used by `eastmountaincode/htmlmusic`. Avoid decorative cards, subtitles, tooltips, and implementation copy.

## Modules

- `useDataLink.ts`: EarthScope connection and packet continuity.
- `useMidiControls.ts`: Web MIDI connection lifecycle.
- `midi.ts`: pure MIDI decoding and control mapping.
- `sequencer.ts`: pure pattern, pitch, and clock-position logic.
- `SequencerPanel.tsx`: grid editing and record controls.
- `useSequencerPlayhead.ts`: continuously derived clock position.
- `useMelodicSequencer.ts`: pattern state and quantized MIDI recording.
- `useSeismicAudio.ts`: React playback state and lifecycle.
- `audioEngine.ts`: Web Audio graph and live-loop refresh.
- `SeismicInstrument.tsx`: interface composition only.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`, then verify `/` and `/earthscope/steps`, live packet arrival, start/stop, sustained playback, control changes, sequencer On/Record, MIDI note recording, pointer draw/erase, and absence of runtime overlays.
