/** 16×16 SMB-style coin frames. */

export const COIN_PALETTE: Record<string, string> = {
  '.': '',
  O: '#1a0800',
  G: '#f8b800',
  R: '#ac7c00',
  L: '#fce0a8',
  W: '#fcfcfc',
  E: '#bcbcbc',
};

export const COIN_SLOT_PX = 18;
export const COIN_ART_PX = 16;

function frame(rows: string[]): string[] {
  return rows.map((row, i) => {
    if (row.length !== 16) {
      throw new Error(`Coin row ${i} length ${row.length}: ${row}`);
    }
    return row;
  });
}

export const FRAME_PIXELS = [
  frame([
    '................',
    '....OOOOOOOO....',
    '...OOGGGGGGOO...',
    '..OOGRWRRRGGOO..',
    '.OOGRGGGGGRGOO..',
    'OOGRGGGLLGRGOO..',
    'OOGRGGGLLGRGOO..',
    'OOGRGGGLLGRGOO..',
    'OOGRGGGLLGRGOO..',
    'OOGRGGGLLGRGOO..',
    'OOGRGGGLLGRGOO..',
    'OOGRGGGLLGRGOO..',
    '.OOGRGGGGGRGOO..',
    '..OOGRRRRRGGOO..',
    '...OOGGGGGGOO...',
    '....OOOOOOOO....',
  ]),
  frame([
    '................',
    '......OOOO......',
    '.....OOGOO......',
    '.....OGRGO......',
    '.....OGGGO......',
    '.....OGGGO......',
    '.....OGGGO......',
    '.....OGGGO......',
    '.....OGGGO......',
    '.....OGRGO......',
    '.....OOGOO......',
    '......OOOO......',
    '................',
    '................',
    '................',
    '................',
  ]),
  frame([
    '................',
    '.......OO.......',
    '.......OEO......',
    '.......OEO......',
    '.......OEO......',
    '.......OEO......',
    '.......OEO......',
    '.......OEO......',
    '.......OEO......',
    '.......OEO......',
    '.......OEO......',
    '.......OO.......',
    '................',
    '................',
    '................',
    '................',
  ]),
  frame([
    '................',
    '......OOOO......',
    '......OOGOO.....',
    '......OGLGO.....',
    '......OGGGO.....',
    '......OGGGO.....',
    '......OGGGO.....',
    '......OGGGO.....',
    '......OGGGO.....',
    '......OGLGO.....',
    '......OOGOO.....',
    '......OOOO......',
    '................',
    '................',
    '................',
    '................',
  ]),
];

export const COIN_FRAME_PX = 64;
export const COIN_STRIP_PX = COIN_SLOT_PX * FRAME_PIXELS.length * 4;
