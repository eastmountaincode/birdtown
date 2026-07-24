# Birdtown

A Next.js browser instrument driven by the live EarthScope `CO.BIRD.00.HHZ`
waveform.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## MPK mini

Press **Connect MPK mini** once. The app prefers `MPK mini IV MIDI Port`, which
is the MPK's normal performance-and-knob port. Use the **Input** menu to switch
to the DAW, Software Control, Clarett, or another browser-visible MIDI input if
that is where your current MPK preset is sending data.

The status changes from `waiting for knob data` to `receiving knob data` only
after a real mapped control message arrives. Connecting or disconnecting another
CoreMIDI device causes the selected input to be reopened automatically.

The knob mapping remains fixed—there is no knob-learning step:

| Knob CC | Control |
| --- | --- |
| 24 | Samples in loop |
| 25 | Repeats per second |
| 26 | Low-pass |
| 27 | Resonance |

Relative mode is the default. Choose Absolute only if the MPK program is set to
send absolute knob values.

## Code layout

- `app/lib/useDataLink.ts` owns the EarthScope connection and rolling buffer.
- `app/earthscope/useMidiControls.ts` owns Web MIDI connection lifecycle.
- `app/earthscope/midi.ts` contains the pure MPK mapping math.
- `app/earthscope/useSeismicAudio.ts` owns playback state.
- `app/earthscope/audioEngine.ts` renders and refreshes the live audio loop.
- `app/earthscope/SeismicInstrument.tsx` only composes the interface.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
