import type { ReactNode } from 'react';

/** 16×16 NES-style coin frames (face → 3/4 → edge → 3/4). */

const C = {
  _: '',
  O: '#1a0800',
  D: '#d82800',
  G: '#f8b800',
  H: '#fcfcfc',
  S: '#f87858',
  E: '#bcbcbc',
} as const;

type Ch = keyof typeof C;

const FRAME_FACE: Ch[][] = [
  '________________',
  '____OOOOOOOO____',
  '___OOGGGGGGOO___',
  '__OOGGGGGGGGOO__',
  '_OOGGGHGGGHGGGO_',
  'OOGGGDOOGGDOOGGO',
  'OOGGO____OOGGOO_',
  'OOGGGGDDGGGGGOO_',
  'OOGGGGDDGGGGGOO_',
  'OOGGO____OOGGOO_',
  'OOGGGDOOGGDOOGGO',
  '_OOGGGHGGGHGGGO_',
  '__OOGGGGGGGGOO__',
  '___OOGGGGGGOO___',
  '____OOOOOOOO____',
  '________________',
].map((row) => row.split('').map((ch) => ch as Ch));

const FRAME_THREE_Q: Ch[][] = [
  '________________',
  '_____OOOOO______',
  '_____OGGGGO_____',
  '_____OGGHGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGHGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OOOOO______',
  '________________',
  '________________',
].map((row) => row.split('').map((ch) => ch as Ch));

const FRAME_EDGE: Ch[][] = [
  '________________',
  '______OO________',
  '______OEO_______',
  '______OEO_______',
  '______OEO_______',
  '______OEO_______',
  '______OEO_______',
  '______OEO_______',
  '______OEO_______',
  '______OEO_______',
  '______OEO_______',
  '______OEO_______',
  '______OO________',
  '________________',
  '________________',
  '________________',
].map((row) => row.split('').map((ch) => ch as Ch));

const FRAME_THREE_Q_L: Ch[][] = [
  '________________',
  '_____OOOOO______',
  '_____OGGGGO_____',
  '_____OGHGOO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OGHGOO_____',
  '_____OGGGGO_____',
  '_____OGGGGO_____',
  '_____OOOOO______',
  '________________',
  '________________',
].map((row) => row.split('').map((ch) => ch as Ch));

const FRAMES = [FRAME_FACE, FRAME_THREE_Q, FRAME_EDGE, FRAME_THREE_Q_L];

const FRAME_PX = 16;
const DISPLAY_PX = 64;
const SCALE = DISPLAY_PX / FRAME_PX;
const STRIP_W = FRAME_PX * FRAMES.length;

function frameRects(frame: Ch[][], offsetX: number) {
  const rects: ReactNode[] = [];
  frame.forEach((row, y) => {
    row.forEach((ch, x) => {
      const fill = C[ch];
      if (!fill) return;
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
    });
  });
  return rects;
}

function SingleFrameSvg({ frame, className }: { frame: Ch[][]; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${FRAME_PX} ${FRAME_PX}`}
      width={DISPLAY_PX}
      height={DISPLAY_PX}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {frameRects(frame, 0)}
    </svg>
  );
}

type RetroCoinSpriteProps = {
  mode?: 'animate' | 'strip';
};

export function RetroCoinSprite({ mode = 'animate' }: RetroCoinSpriteProps) {
  if (mode === 'strip') {
    return (
      <svg
        className="rr-loader__coin-svg rr-loader__coin-svg--strip"
        viewBox={`0 0 ${STRIP_W} ${FRAME_PX}`}
        width={STRIP_W * SCALE}
        height={DISPLAY_PX}
        shapeRendering="crispEdges"
        aria-hidden
      >
        {FRAMES.flatMap((frame, i) => frameRects(frame, i * FRAME_PX))}
      </svg>
    );
  }

  return (
    <span className="rr-loader__sprite" aria-hidden>
      {FRAMES.map((frame, index) => (
        <SingleFrameSvg
          key={index}
          frame={frame}
          className={`rr-loader__coin-frame rr-loader__coin-frame--${index}`}
        />
      ))}
    </span>
  );
}
