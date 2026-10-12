export type CanvasFrameRate = 30 | 60 | 'display';

/** A zero interval lets requestAnimationFrame follow the display refresh rate. */
export function canvasFrameInterval(rate: CanvasFrameRate): number {
  return rate === 'display' ? 0 : 1000 / rate;
}

export function isCanvasFrameDue(now: number, lastFrame: number, rate: CanvasFrameRate): boolean {
  const interval = canvasFrameInterval(rate);
  return lastFrame === 0 || interval === 0 || now - lastFrame >= interval;
}
