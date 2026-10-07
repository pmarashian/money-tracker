export type BackgroundId =
  | 'none'
  | 'bg_01_aurora'
  | 'bg_02_pixel_grid'
  | 'bg_03_parallax_hills'
  | 'bg_04_night_town';

export const DEFAULT_BACKGROUND_ID: BackgroundId = 'bg_01_aurora';

export interface BackgroundOption {
  id: BackgroundId;
  label: string;
  subtitle: string;
  src: string | null;
}

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: 'bg_01_aurora',
    label: 'SNES aurora night',
    subtitle: 'bg_01_aurora',
    src: '/backgrounds/bg_01_aurora.webp',
  },
  {
    id: 'bg_02_pixel_grid',
    label: 'NES grid horizon',
    subtitle: 'bg_02_pixel_grid',
    src: '/backgrounds/bg_02_pixel_grid.webp',
  },
  {
    id: 'bg_03_parallax_hills',
    label: '16-bit dusk hills',
    subtitle: 'bg_03_parallax_hills',
    src: '/backgrounds/bg_03_parallax_hills.webp',
  },
  {
    id: 'bg_04_night_town',
    label: '8-bit stars + town',
    subtitle: 'bg_04_night_town',
    src: '/backgrounds/bg_04_night_town.webp',
  },
  {
    id: 'none',
    label: 'None',
    subtitle: 'Plain black',
    src: null,
  },
];

export function isBackgroundId(value: string | null | undefined): value is BackgroundId {
  return BACKGROUND_OPTIONS.some((o) => o.id === value);
}

export function getBackgroundSrc(id: BackgroundId): string | null {
  return BACKGROUND_OPTIONS.find((o) => o.id === id)?.src ?? null;
}
