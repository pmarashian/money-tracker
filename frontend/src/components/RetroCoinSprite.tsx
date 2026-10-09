import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  COIN_ART_PX,
  COIN_FRAME_PX,
  COIN_PALETTE,
  COIN_SLOT_PX,
  COIN_STRIP_PX,
  FRAME_PIXELS,
} from './retroCoinArt';

function frameRects(frame: string[], offsetX = 0) {
  const rects: ReactNode[] = [];
  frame.forEach((row, y) => {
    for (let x = 0; x < COIN_ART_PX; x += 1) {
      const fill = COIN_PALETTE[row[x]];
      if (!fill) continue;
      rects.push(
        <rect
          key={`${offsetX}-${x}-${y}`}
          x={offsetX + x}
          y={y}
          width={1}
          height={1}
          fill={fill}
        />
      );
    }
  });
  return rects;
}

/** One full spin = 4 frames at 200ms (same 0.8s cycle as before). */
export const COIN_FRAME_MS = 200;

/**
 * Frame index driven by JS, not CSS keyframes. The old version stacked 4 SVG <g>
 * frames and toggled opacity with steps() keyframes + negative delays, which iOS
 * WebKit (WKWebView) did not reliably run: the coin blinked instead of spinning.
 * Rendering exactly one frame at a time can never show zero or overlapping frames.
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
  const frame = useCoinFrame(FRAME_PIXELS.length, mode === 'animate' && !reducedMotion);
  const frames = useMemo(() => FRAME_PIXELS.map((f) => frameRects(f)), []);
  if (mode === 'strip') {
    const stripSlots = FRAME_PIXELS.length * COIN_SLOT_PX;
    return (
      <svg
        className="rr-loader__coin-svg rr-loader__coin-svg--strip"
        viewBox={`0 0 ${stripSlots} ${COIN_ART_PX}`}
        width={COIN_STRIP_PX}
        height={COIN_FRAME_PX}
        shapeRendering="crispEdges"
        aria-hidden
      >
        {FRAME_PIXELS.flatMap((frame, i) => frameRects(frame, i * COIN_SLOT_PX))}
      </svg>
    );
  }

  return (
    <span className="rr-loader__sprite" aria-hidden>
      <svg
        className="rr-loader__coin-stage"
        viewBox={`0 0 ${COIN_ART_PX} ${COIN_ART_PX}`}
        width={COIN_FRAME_PX}
        height={COIN_FRAME_PX}
        shapeRendering="crispEdges"
      >
        <g className="rr-loader__coin-frame" data-frame={frame}>
          {frames[frame]}
        </g>
      </svg>
    </span>
  );
}
