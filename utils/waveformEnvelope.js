export const computeWaveformEnvelopeRect = (
  minSample,
  maxSample,
  ampPx,
  volume,
  { boost = 1.8, minBarHeightPx = 1 } = {}
) => {
  let minV = Number(minSample);
  let maxV = Number(maxSample);
  const amp = Number(ampPx);
  const vol = Number(volume);

  if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return null;
  if (!Number.isFinite(amp) || amp <= 0) return null;
  if (!Number.isFinite(vol) || vol <= 0) return null;

  const boostV = Number.isFinite(boost) ? Math.max(0, boost) : 0;
  const minH = Number.isFinite(minBarHeightPx) ? Math.max(0, minBarHeightPx) : 0;

  if (minV > maxV) [minV, maxV] = [maxV, minV];
  if (minV === 0 && maxV === 0) return null;

  // Clamp just in case.
  minV = Math.max(-1, Math.min(1, minV));
  maxV = Math.max(-1, Math.min(1, maxV));

  const heightPx = amp * 2;
  const yFromSample = (sample) => amp - sample * amp * boostV * vol;

  let y1 = yFromSample(maxV);
  let y2 = yFromSample(minV);

  // Clamp to canvas range; canvas will clip anyway but keeping numbers sane helps.
  y1 = Math.max(0, Math.min(heightPx, y1));
  y2 = Math.max(0, Math.min(heightPx, y2));

  let top = Math.min(y1, y2);
  let bottom = Math.max(y1, y2);
  let h = bottom - top;

  if (h > 0 && h < minH) {
    const mid = (top + bottom) / 2;
    top = mid - minH / 2;
    bottom = mid + minH / 2;
    top = Math.max(0, Math.min(heightPx, top));
    bottom = Math.max(0, Math.min(heightPx, bottom));
    h = bottom - top;
  }

  if (h <= 0) return null;
  return { y: top, height: h };
};

