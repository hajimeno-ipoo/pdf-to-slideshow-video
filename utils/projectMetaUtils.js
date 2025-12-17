export const estimateProjectBytes = (projectData) => {
  if (!projectData) return 0;
  let total = 0;

  const addFile = (f) => {
    const size = Number(f?.size);
    if (Number.isFinite(size) && size > 0) total += size;
  };

  const addString = (s) => {
    if (typeof s !== 'string') return;
    // JS string is UTF-16 internally (rough estimate: 2 bytes/char)
    total += s.length * 2;
  };

  addFile(projectData.sourceFile);
  addFile(projectData.bgmFile);
  addFile(projectData.globalAudioFile);

  const slides = Array.isArray(projectData.slides) ? projectData.slides : [];
  for (const s of slides) {
    addString(s?.thumbnailUrl);
    addString(s?.narrationScript);
    addFile(s?.audioFile);
    addFile(s?.customImageFile);
    const overlays = Array.isArray(s?.overlays) ? s.overlays : [];
    total += overlays.length * 64; // tiny overhead estimate per overlay
    for (const ov of overlays) addString(ov?.imageData);
  }

  addFile(projectData.videoSettings?.backgroundImageFile);

  return total;
};

export const formatBytes = (bytes) => {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '0B';
  if (b < 1024) return `${Math.round(b)}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)}MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)}GB`;
};

