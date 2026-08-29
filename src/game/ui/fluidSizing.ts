export function clampValue(min: number, preferred: number, max: number): number {
  return Math.min(max, Math.max(min, preferred));
}

export function fluidValue(min: number, containerSize: number, ratio: number, max: number): number {
  return clampValue(min, containerSize * ratio, max);
}

export function lerpClamped(min: number, max: number, value: number, from: number, to: number): number {
  if (from === to) return min;
  const progress = clampValue(0, (value - from) / (to - from), 1);
  return min + (max - min) * progress;
}
