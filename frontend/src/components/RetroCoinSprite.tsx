import { useEffect, useState } from 'react';
import coinSpritesheet from '../assets/rd-coin-spritesheet.png';

/** Spritesheet: 192×32, six 32×32 frames in one row. */
const FRAME_COUNT = 6;
/** Displayed size (2× source for crisp pixel scale). */
export const COIN_FRAME_PX = 64;
/** ~133ms × 6 ≈ 0.8s per full spin (same cycle length as the old 4×200ms loader). */
export const COIN_FRAME_MS = 133;

/**
 * Frame index driven by JS, not CSS keyframes. Rendering exactly one frame at a
 * time avoids iOS WebKit opacity/keyframe blinks on stacked SVG frames.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

function useCoinFrame(frameCount: number, animate: boolean): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % frameCount);
    }, COIN_FRAME_MS);
    return () => window.clearInterval(id);
  }, [frameCount, animate]);
  return animate ? frame : 0;
}

type RetroCoinSpriteProps = {
  mode?: 'animate' | 'strip';
};

export function RetroCoinSprite({ mode = 'animate' }: RetroCoinSpriteProps) {
  const reducedMotion = usePrefersReducedMotion();
  const frame = useCoinFrame(FRAME_COUNT, mode === 'animate' && !reducedMotion);

  if (mode === 'strip') {
    return (
      <span
        className="rr-loader__coin-strip"
        style={{
          width: COIN_FRAME_PX * FRAME_COUNT,
          height: COIN_FRAME_PX,
          backgroundImage: `url(${coinSpritesheet})`,
          backgroundSize: `${COIN_FRAME_PX * FRAME_COUNT}px ${COIN_FRAME_PX}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
        aria-hidden
      />
    );
  }

  return (
    <span className="rr-loader__sprite" aria-hidden>
      <span
        className="rr-loader__coin-stage"
        data-frame={frame}
        style={{
          width: COIN_FRAME_PX,
          height: COIN_FRAME_PX,
          backgroundImage: `url(${coinSpritesheet})`,
          backgroundSize: `${COIN_FRAME_PX * FRAME_COUNT}px ${COIN_FRAME_PX}px`,
          backgroundPosition: `-${frame * COIN_FRAME_PX}px 0`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      />
    </span>
  );
}
