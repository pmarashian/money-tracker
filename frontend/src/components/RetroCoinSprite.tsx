import type { ReactNode } from 'react';
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

type RetroCoinSpriteProps = {
  mode?: 'animate' | 'strip';
};

export function RetroCoinSprite({ mode = 'animate' }: RetroCoinSpriteProps) {
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
        {FRAME_PIXELS.map((frame, index) => (
          <g key={index} className={`rr-loader__coin-frame rr-loader__coin-frame--${index}`}>
            {frameRects(frame)}
          </g>
        ))}
      </svg>
    </span>
  );
}
