import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { BACKGROUND_OPTIONS, type BackgroundId } from '../lib/appBackgrounds';
import { RrCmdButton } from './rr/RrCmdButton';

interface BackgroundPickerCarouselProps {
  backgroundId: BackgroundId;
  onSelect: (id: BackgroundId) => void;
}

export const BackgroundPickerCarousel: FC<BackgroundPickerCarouselProps> = ({
  backgroundId,
  onSelect,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, BACKGROUND_OPTIONS.findIndex((o) => o.id === backgroundId))
  );

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'auto') => {
    const track = trackRef.current;
    const slide = slideRefs.current[index];
    if (!track || !slide) return;
    const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
    track.scrollTo({ left, behavior });
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    const idx = Math.max(0, BACKGROUND_OPTIONS.findIndex((o) => o.id === backgroundId));
    const frame = requestAnimationFrame(() => scrollToIndex(idx, 'auto'));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial scroll only when picker mounts
  }, []);

  const updateActiveIndexFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    slideRefs.current.forEach((slide, i) => {
      if (!slide) return;
      const childCenter = slide.offsetLeft + slide.clientWidth / 2;
      const dist = Math.abs(center - childCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', updateActiveIndexFromScroll, { passive: true });
    return () => track.removeEventListener('scroll', updateActiveIndexFromScroll);
  }, [updateActiveIndexFromScroll]);

  const previewOption = BACKGROUND_OPTIONS[activeIndex];
  const previewSelected = previewOption?.id === backgroundId;

  const handleUseBackground = () => {
    if (!previewOption) return;
    onSelect(previewOption.id);
  };

  return (
    <div className="bg-carousel" role="region" aria-label="Background carousel">
      <div className="bg-carousel__track" ref={trackRef}>
        {BACKGROUND_OPTIONS.map((option, index) => {
          const isApplied = backgroundId === option.id;
          return (
            <div
              key={option.id}
              className="bg-carousel__slide"
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
            >
              <div
                className={`bg-carousel__preview${isApplied ? ' bg-carousel__preview--selected' : ''}`}
              >
                {option.src ? (
                  <div
                    className="bg-carousel__preview-bg"
                    style={{ backgroundImage: `url(${option.src})` }}
                    aria-hidden
                  />
                ) : (
                  <div className="bg-carousel__preview-bg bg-carousel__preview-bg--none" aria-hidden />
                )}
                <div className="rr-win rr-win--dq bg-carousel__mock-win">
                  <span className="rr-tag">BALANCE</span>
                  <p className="rr-hero-label">Before next bonus</p>
                  <p className="rr-hero-value">$4,250</p>
                </div>
                {isApplied && (
                  <span className="bg-carousel__applied" aria-label="Currently in use">✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-carousel__dots" role="tablist" aria-label="Background pages">
        {BACKGROUND_OPTIONS.map((option, index) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={option.label}
            className={`bg-carousel__dot${index === activeIndex ? ' bg-carousel__dot--active' : ''}`}
            onClick={() => scrollToIndex(index)}
          />
        ))}
      </div>

      <p className="bg-carousel__name">{previewOption?.label ?? ''}</p>

      <RrCmdButton onClick={handleUseBackground} disabled={previewSelected} showCursor={!previewSelected}>
        {previewSelected ? 'In use' : 'Use this background'}
      </RrCmdButton>
    </div>
  );
};
