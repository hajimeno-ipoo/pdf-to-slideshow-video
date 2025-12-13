export const clampSeconds = (seconds, durationSeconds) => {
  if (!Number.isFinite(seconds)) return 0;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return Math.max(0, seconds);
  return Math.min(Math.max(0, seconds), durationSeconds);
};

export const formatSecondsForFilename = (seconds) => {
  const v = Math.round(seconds * 10) / 10;
  const s = v.toFixed(1).replace(/\.0$/, '');
  return s.replace('.', '_');
};

export const buildThumbnailCaptureTimes = (
  startSeconds,
  endSeconds,
  durationSeconds,
  maxFrames = 20
) => {
  const start = clampSeconds(startSeconds, durationSeconds);
  const end = clampSeconds(endSeconds, durationSeconds);

  const frames = Math.floor(maxFrames);
  if (!Number.isFinite(frames) || frames <= 1) return [start];
  if (end <= start) return [start];

  const step = (end - start) / (frames - 1);
  const times = Array.from({ length: frames }, (_, i) =>
    Math.round((start + step * i) * 1000) / 1000
  );

  times[0] = start;
  times[times.length - 1] = end;

  const seen = new Set();
  return times.filter((t) => {
    const key = String(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

