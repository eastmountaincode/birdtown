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

Press **Connect MPK mini** once. The app treats the MPK mini IV MIDI and DAW
ports as one controller and listens to both. Use the **Input** menu to select a
different browser-visible MIDI input when needed. Connecting or disconnecting a
CoreMIDI device causes the selected input to be reopened automatically.

The knob mapping remains fixed—there is no knob-learning step:

| Knob CC | Control |
| --- | --- |
| 24 | Samples in loop |
| 25 | Repeats per second |
| 26 | Low-pass |
| 27 | Resonance |

The MPK program must send relative knob values.

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
