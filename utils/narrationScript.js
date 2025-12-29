export const extractNarrationText = (raw) => {
  if (raw === null || raw === undefined) return '';

  const original = typeof raw === 'string' ? raw : String(raw);
  const trimmed = original.trim();
  if (!trimmed) return '';

  // Prefer structured output (responseMimeType: "application/json", responseSchema)
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && typeof parsed.narration === 'string') {
      const narration = parsed.narration.trim();
      if (narration) return narration;
    }
  } catch {
    // ignore
  }

  // Fallback: handle common "ナレーション原稿:" markers and markdown noise.
  let text = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const lines = text.split(/\r?\n/);
  const markerIndexWithColon = lines.findIndex((line) => /ナレーション原稿\s*[:：]/.test(line));
  const markerIndex = markerIndexWithColon !== -1
    ? markerIndexWithColon
    : lines.findIndex((line) => /^[\s\-–—*#]*ナレーション原稿[\s\-–—*#]*$/.test(line));
  if (markerIndex !== -1) {
    const markerLine = lines[markerIndex];
    const markerPos = markerLine.indexOf('ナレーション原稿');
    const afterMarker = markerLine.slice(markerPos + 'ナレーション原稿'.length);

    let inline = '';
    const colonMatch = afterMarker.match(/[:：](.*)$/);
    if (colonMatch) {
      inline = (colonMatch[1] || '').replace(/^[\s\-–—*#]+/, '').trim();
    }

    const rest = lines.slice(markerIndex + 1).join('\n').trim();
    const combined = [inline, rest].filter(Boolean).join('\n').trim();
    if (combined) return combined;
  }

  return text;
};
