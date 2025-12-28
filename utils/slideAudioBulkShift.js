const round2 = (n) => Number(n.toFixed(2));

export const applySlideAudioOffsetDelta = (slides, deltaSeconds, options = {}) => {
  if (!Array.isArray(slides)) return [];

  const delta = Number(deltaSeconds);
  if (!Number.isFinite(delta) || delta === 0) return slides;

  const extendDuration = !!options.extendDuration;

  let changed = false;
  const next = slides.map((slide) => {
    if (!slide || !slide.audioFile) return slide;

    const oldOffsetRaw = slide.audioOffset ?? 0;
    const oldOffset = Number.isFinite(Number(oldOffsetRaw)) ? Number(oldOffsetRaw) : 0;

    const newOffset = Math.max(0, oldOffset + delta);
    const roundedOffset = round2(newOffset);

    const appliedShift = roundedOffset - oldOffset;
    const durationRaw = slide.duration ?? 0;
    const duration = Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : 0;
    const nextDuration = extendDuration && appliedShift > 0 ? round2(Math.max(0.1, duration + appliedShift)) : duration;

    if (roundedOffset === oldOffset && nextDuration === duration) return slide;

    changed = true;
    return {
      ...slide,
      audioOffset: roundedOffset,
      duration: nextDuration,
    };
  });

  return changed ? next : slides;
};

