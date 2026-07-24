export const TEMPO_MIN = 30;
export const TEMPO_MAX = 300;
export const DEFAULT_TEMPO = 120;

export function clampTempo(value: number) {
  const finiteValue = Number.isFinite(value) ? value : TEMPO_MIN;
  return Math.round(Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, finiteValue)));
}
