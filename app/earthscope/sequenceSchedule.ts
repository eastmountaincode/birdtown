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
  const currentNote = sequence.notes[position.step] ?? null;
  const events: SequenceScheduleEvent[] = [
    {
      at: now,
      gateOpen: currentNote !== null,
      rate: sequenceRateAtStep(
        sequence,
        position.step,
        fallbackRate,
      ),
      step: position.step,
    },
  ];
  const stepDuration = sequenceStepDurationSeconds(tempoBpm);
  let step = (position.step + 1) % sequence.length;
  let stepAt = now + (1 - position.progress) * stepDuration;

  while (stepAt < until) {
    const note = sequence.notes[step] ?? null;
    events.push({
      at: stepAt,
      gateOpen: note !== null,
      rate:
        note === null
          ? null
          : sequenceRateAtStep(sequence, step, fallbackRate),
      step,
    });
    step = (step + 1) % sequence.length;
    stepAt += stepDuration;
  }

  return { events, scheduledUntil: stepAt };
}
