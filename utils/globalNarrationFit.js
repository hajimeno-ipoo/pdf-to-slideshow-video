export const GLOBAL_NARRATION_DURATION_BASE_KEY = 'durationBeforeGlobalAudioFit';

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clampPositive = (value, fallback) => {
  const n = toFiniteNumber(value);
  if (n === null) return fallback;
  if (n > 0) return n;
  return fallback;
};

const allocateDurationsByRatio = ({ weights, targetSeconds, minSeconds }) => {
  const n = weights.length;
  const safeMin = clampPositive(minSeconds, 0.1);
  const safeTarget = clampPositive(targetSeconds, safeMin * n);
  const minTotal = safeMin * n;
  if (safeTarget <= minTotal) {
    return Array.from({ length: n }, () => safeMin);
  }

  const durations = new Array(n).fill(0);
  const active = new Array(n).fill(true);
  let remainingTarget = safeTarget;
  let remainingWeightSum = weights.reduce((acc, w) => acc + w, 0);
  let activeCount = n;

  while (activeCount > 0) {
    const scale = remainingTarget / remainingWeightSum;
    let clampedAny = false;

    for (let i = 0; i < n; i += 1) {
      if (!active[i]) continue;
      const d = weights[i] * scale;
      if (d < safeMin) {
        durations[i] = safeMin;
        active[i] = false;
        remainingTarget -= safeMin;
        remainingWeightSum -= weights[i];
        activeCount -= 1;
        clampedAny = true;
      }
    }

    if (!clampedAny) {
      for (let i = 0; i < n; i += 1) {
        if (!active[i]) continue;
        durations[i] = weights[i] * scale;
      }
      break;
    }
  }

  return durations;
};

const roundDurationsToTicks = ({ durations, targetSeconds, tickSeconds, minSeconds }) => {
  const n = durations.length;
  const tick = clampPositive(tickSeconds, 0.01);
  const safeMin = clampPositive(minSeconds, 0.1);
  const minTicks = Math.ceil(safeMin / tick);
  const targetTicks = Math.max(0, Math.round(targetSeconds / tick));
  if (targetTicks <= 0) return Array.from({ length: n }, () => minTicks * tick);

  const rawTicks = durations.map((d) => d / tick);
  const ticks = rawTicks.map((v) => Math.max(minTicks, Math.floor(v)));

  let sum = ticks.reduce((acc, t) => acc + t, 0);
  let remaining = targetTicks - sum;

  if (remaining !== 0) {
    const ranks = rawTicks
      .map((v, i) => ({ i, rem: v - Math.floor(v) }))
      .sort((a, b) => (b.rem - a.rem) || (a.i - b.i));

    // Add ticks
    for (let k = 0; k < ranks.length && remaining > 0; k += 1) {
      ticks[ranks[k].i] += 1;
      remaining -= 1;
    }

    // Remove ticks (rare; mainly for weird min/tick combos)
    for (let k = ranks.length - 1; k >= 0 && remaining < 0; k -= 1) {
      const i = ranks[k].i;
      if (ticks[i] <= minTicks) continue;
      ticks[i] -= 1;
      remaining += 1;
    }
  }

  // Final safety: match target by adjusting last slide if possible.
  sum = ticks.reduce((acc, t) => acc + t, 0);
  if (sum !== targetTicks && n > 0) {
    const diff = targetTicks - sum;
    ticks[n - 1] = Math.max(minTicks, ticks[n - 1] + diff);
  }

  return ticks.map((t) => t * tick);
};

export const fitSlidesToGlobalNarrationDuration = (slides, targetSeconds, options = {}) => {
  if (!Array.isArray(slides) || slides.length === 0) return Array.isArray(slides) ? slides : [];

  const tickSeconds = clampPositive(options.tickSeconds, 0.01);
  const minSeconds = clampPositive(options.minSeconds, 0.1);
  const baseKey = typeof options.baseKey === 'string' && options.baseKey ? options.baseKey : GLOBAL_NARRATION_DURATION_BASE_KEY;

  const target = toFiniteNumber(targetSeconds);
  if (target === null || target <= 0) return slides;

  const n = slides.length;

  const baseDurations = slides.map((s) => {
    const base = toFiniteNumber(s?.[baseKey]);
    if (base !== null && base > 0) return base;
    const d = toFiniteNumber(s?.duration);
    if (d !== null && d > 0) return d;
    return minSeconds;
  });
  const weights = baseDurations.map((d) => clampPositive(d, minSeconds));

  const continuous = allocateDurationsByRatio({ weights, targetSeconds: target, minSeconds });
  const fittedSeconds = roundDurationsToTicks({ durations: continuous, targetSeconds: target, tickSeconds, minSeconds });

  return slides.map((s, i) => {
    const existingBase = toFiniteNumber(s?.[baseKey]);
    const base = existingBase !== null && existingBase > 0 ? existingBase : baseDurations[i];
    return {
      ...s,
      duration: fittedSeconds[i],
      [baseKey]: base,
    };
  });
};

export const restoreSlidesFromGlobalNarrationFit = (slides, options = {}) => {
  if (!Array.isArray(slides) || slides.length === 0) return Array.isArray(slides) ? slides : [];
  const baseKey = typeof options.baseKey === 'string' && options.baseKey ? options.baseKey : GLOBAL_NARRATION_DURATION_BASE_KEY;

  return slides.map((s) => {
    const base = toFiniteNumber(s?.[baseKey]);
    if (base === null || base <= 0) return s;
    const { [baseKey]: _removed, ...rest } = s;
    return {
      ...rest,
      duration: base,
    };
  });
};
