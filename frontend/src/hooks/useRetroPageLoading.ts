import { useRetroLoaderVisibility, type RetroLoaderVisibilityOptions } from './useRetroLoaderVisibility';

/** Combines delayed loader visibility with a blocking flag for page-level fetches. */
export function useRetroPageLoading(
  loading: boolean,
  options?: RetroLoaderVisibilityOptions
) {
  const showLoader = useRetroLoaderVisibility(loading, options);
  const blocking = loading || showLoader;
  return { showLoader, blocking };
}
