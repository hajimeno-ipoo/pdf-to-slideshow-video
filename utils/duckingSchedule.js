export const buildDuckingIntervals = (
  segments,
  durationSeconds,
  { lead = 0, tail = 0, mergeGap = 0 } = {}
) => {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const limit =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : Number.POSITIVE_INFINITY;

  const leadSeconds = Number.isFinite(lead) ? Math.max(0, lead) : 0;
  const tailSeconds = Number.isFinite(tail) ? Math.max(0, tail) : 0;
  const mergeGapSeconds = Number.isFinite(mergeGap) ? Math.max(0, mergeGap) : 0;

  const expanded = [];
  for (const seg of segments) {
    if (!seg) continue;
    const start = Number(seg.start);
    const end = Number(seg.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end <= start) continue;

    const s = Math.max(0, start - leadSeconds);
    const e = Math.min(limit, end + tailSeconds);
    if (e <= s) continue;
    expanded.push({ start: s, end: e });
  }

  expanded.sort((a, b) => a.start - b.start);

  const merged = [];
  for (const it of expanded) {
    const last = merged[merged.length - 1];
    if (!last || it.start > last.end + mergeGapSeconds) {
      merged.push({ ...it });
      continue;
    }
    last.end = Math.max(last.end, it.end);
  }

  return merged;
};

