import { expect, test } from 'vitest';
import webAudioEngine from 'web-audio-engine';
import { advanceSequenceRecording } from '../app/earthscope/sequenceRecording';
import { DEFAULT_SEQUENCE } from '../app/earthscope/sequencer';
import { buildSequenceSchedule } from '../app/earthscope/sequenceSchedule';

test('recorded repeated hits produce real silence between rendered gate envelopes', async () => {
  let take = { sequence: DEFAULT_SEQUENCE, cursor: null };
  for (const [position, note] of [[0,33],[.6,null],[1,33],[1.6,null],[2,33],[2.6,null]]) {
    take = advanceSequenceRecording(take.sequence, take.cursor, position, note);
  }
  const ctx = new webAudioEngine.OfflineAudioContext(1, 24000, 48000);
  const source = ctx.createBufferSource();
  source.buffer = ctx.createBuffer(1, 24000, 48000);
  source.buffer.getChannelData(0).fill(1);
  const gate = ctx.createGain(); gate.gain.value = 0;
  source.connect(gate); gate.connect(ctx.destination);
  const schedule = buildSequenceSchedule({ sequence: take.sequence, now:0, startAt:0, until:.5, tempoBpm:120, fallbackRate:4 });
  for (const event of schedule.events) gate.gain.setTargetAtTime(event.gateOpen ? 1 : 0, event.at, .006);
  source.start();
  const data = (await ctx.startRendering()).getChannelData(0);
  const value = time => data[Math.round(time*48000)];
  for (const onset of [0,.125,.25]) {
    expect(value(onset+.04)).toBeGreaterThan(.99);
    expect(value(onset+.12)).toBeLessThan(.001);
  }
});
