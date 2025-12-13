export const getCanvasRenderWidthCss = (
  desiredCssWidth,
  dpr,
  maxDevicePixels = 16384
) => {
  const desired = Number.isFinite(desiredCssWidth) ? Math.max(1, desiredCssWidth) : 1;
  const pixelRatio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const maxPx = Number.isFinite(maxDevicePixels) && maxDevicePixels > 0 ? maxDevicePixels : 16384;

  return Math.min(desired, Math.max(1, Math.floor(maxPx / pixelRatio)));
};

