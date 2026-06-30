import type { Map as MlMap } from 'maplibre-gl';

export interface SpinOptions {
  /** Time for one full rotation, in seconds. */
  secondsPerRevolution?: number;
  /** Only spin while zoomed out below this level (use Infinity to always spin). */
  maxSpinZoom?: number;
  /** Below this zoom the globe spins at full speed; above it eases off. */
  slowSpinZoom?: number;
  /** Pause spinning while the user is interacting and resume after idle. */
  pauseOnInteraction?: boolean;
  /** Idle delay before resuming after interaction, in ms. */
  resumeDelayMs?: number;
}

/**
 * Continuously rotates a MapLibre globe by nudging the centre longitude on each
 * `moveend`. Spinning eases off as the user zooms in and (optionally) pauses
 * while they interact, giving the "living earth" effect without fighting input.
 */
export function createGlobeSpin(map: MlMap, opts: SpinOptions = {}) {
  const secondsPerRevolution = opts.secondsPerRevolution ?? 120;
  const maxSpinZoom = opts.maxSpinZoom ?? 5;
  const slowSpinZoom = opts.slowSpinZoom ?? 3;
  const pauseOnInteraction = opts.pauseOnInteraction ?? true;
  const resumeDelayMs = opts.resumeDelayMs ?? 4000;

  let enabled = false;
  let interacting = false;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;

  function step(): void {
    if (!enabled || interacting) return;
    const zoom = map.getZoom();
    if (zoom >= maxSpinZoom) return;
    let degPerSec = 360 / secondsPerRevolution;
    if (zoom > slowSpinZoom) {
      degPerSec *= (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
    }
    const center = map.getCenter();
    center.lng -= degPerSec;
    map.easeTo({ center, duration: 1000, easing: (n) => n });
  }

  const onMoveEnd = () => step();
  const onInteractStart = () => {
    if (!pauseOnInteraction) return;
    interacting = true;
    if (resumeTimer) clearTimeout(resumeTimer);
  };
  const onInteractEnd = () => {
    if (!pauseOnInteraction) return;
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      interacting = false;
      step();
    }, resumeDelayMs);
  };

  map.on('moveend', onMoveEnd);
  map.on('mousedown', onInteractStart);
  map.on('touchstart', onInteractStart);
  map.on('dragstart', onInteractStart);
  map.on('mouseup', onInteractEnd);
  map.on('touchend', onInteractEnd);
  map.on('dragend', onInteractEnd);
  map.on('wheel', () => {
    onInteractStart();
    onInteractEnd();
  });

  return {
    start(): void {
      enabled = true;
      step();
    },
    stop(): void {
      enabled = false;
      if (resumeTimer) clearTimeout(resumeTimer);
    },
    destroy(): void {
      enabled = false;
      if (resumeTimer) clearTimeout(resumeTimer);
      map.off('moveend', onMoveEnd);
      map.off('mousedown', onInteractStart);
      map.off('touchstart', onInteractStart);
      map.off('dragstart', onInteractStart);
      map.off('mouseup', onInteractEnd);
      map.off('touchend', onInteractEnd);
      map.off('dragend', onInteractEnd);
    },
  };
}
