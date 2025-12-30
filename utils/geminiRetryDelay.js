const parseSecondsToMs = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) return null;

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return Math.ceil(seconds * 1000);
};

export const getGeminiRetryDelayMs = (error, fallbackMessage = '') => {
  // Prefer structured error details (google.rpc.RetryInfo)
  const details =
    error?.error?.details ||
    error?.details;

  if (Array.isArray(details)) {
    for (const d of details) {
      const retryDelay = d?.retryDelay;
      const ms = parseSecondsToMs(retryDelay);
      if (ms) return ms;
    }
  }

  const message = typeof fallbackMessage === 'string' ? fallbackMessage : '';

  // Fallback: parse embedded RetryInfo or guidance text from the message
  const m1 = message.match(/retryDelay\":\"([0-9]+(?:\.[0-9]+)?)s\"/);
  if (m1) {
    const ms = parseSecondsToMs(`${m1[1]}s`);
    if (ms) return ms;
  }

  const m2 = message.match(/Please retry in ([0-9]+(?:\.[0-9]+)?)s/i);
  if (m2) {
    const ms = parseSecondsToMs(`${m2[1]}s`);
    if (ms) return ms;
  }

  return null;
};

