import {
  sequencePositionAtTime,
  sequenceRateAtStep,
  sequenceStepDurationSeconds,
  type MelodicSequence,
} from "./sequencer";

export interface SequenceScheduleEvent {
  at: number;
  gateOpen: boolean;
  rate: number | null;
  step: number;
}

export interface SequenceSchedule {
  events: SequenceScheduleEvent[];
  scheduledUntil: number;
}

export function sequenceAudioStartAt({
  audioNow,
  performanceNowMs,
  startedAtMs,
}: {
  audioNow: number;
  performanceNowMs: number;
  startedAtMs: number | null;
}) {
  return startedAtMs === null
    ? audioNow
    : audioNow + (startedAtMs - performanceNowMs) / 1_000;
}

export function buildSequenceSchedule({
  fallbackRate,
  now,
  sequence,
  startAt,
  tempoBpm,
  until,
}: {
  fallbackRate: number;
  now: number;
  sequence: MelodicSequence;
  startAt: number;
  tempoBpm: number;
  until: number;
}): SequenceSchedule {
  const position = sequencePositionAtTime({
    length: sequence.length,
    now,
    startAt,
    tempoBpm,
  });
  const stepDuration = sequenceStepDurationSeconds(tempoBpm);
  const events: SequenceScheduleEvent[] = [];
  let step = position.step;
  let stepAt = now - position.progress * stepDuration;
  while (stepAt < until) {
    const note = sequence.notes[step] ?? null;
    const nextStep = (step + 1) % sequence.length;
    const retriggerNext = sequence.attacks?.[nextStep] && sequence.notes[nextStep] != null;
    const gateEnd = retriggerNext ? 1 - Math.min(0.024 / stepDuration, 0.25) : 1;
    const gates = (note === null ? [] : sequence.gates?.[step] ?? [{ start: 0, end: 1 }])
      .map(gate => ({ start: gate.start, end: Math.min(gate.end, gateEnd) }))
      .filter(gate => gate.end > gate.start);
    const progress = Math.max(0, (now - stepAt) / stepDuration);
    const at = Math.max(now, stepAt);
    events.push({
      at,
      gateOpen: gates.some(gate => gate.start <= progress + 1e-9 && gate.end > progress + 1e-9),
      rate: stepAt <= now || note !== null ? sequenceRateAtStep(sequence, step, fallbackRate) : null,
      step,
    });
    for (const gate of gates) {
      for (const [offset, gateOpen] of [[gate.start, true], [gate.end, false]] as const) {
        const eventAt = stepAt + offset * stepDuration;
        // Full-step releases belong to the next step: a genuinely held note
        // should remain continuous across a column or loop boundary.
        if ((!gateOpen && offset === 1) || eventAt <= at + 1e-9 || eventAt >= until) continue;
        events.push({ at: eventAt, gateOpen, rate: null, step });
      }
    }
    step = (step + 1) % sequence.length;
    stepAt += stepDuration;
  }
  // Refill from the actual horizon so a later in-step release cannot be skipped.
  return { events, scheduledUntil: until };
}
