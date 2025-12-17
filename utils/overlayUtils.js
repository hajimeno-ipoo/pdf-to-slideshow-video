export const toggleOverlayHidden = (overlays, id) => {
  if (!Array.isArray(overlays)) return [];
  return overlays.map(o => (o && o.id === id ? { ...o, hidden: !o.hidden } : o));
};

export const toggleOverlayLocked = (overlays, id) => {
  if (!Array.isArray(overlays)) return [];
  return overlays.map(o => (o && o.id === id ? { ...o, locked: !o.locked } : o));
};

export const deleteOverlayById = (overlays, id) => {
  if (!Array.isArray(overlays)) return [];
  return overlays.filter(o => o && o.id !== id);
};

export const nudgeOverlayById = (overlays, id, dx, dy) => {
  if (!Array.isArray(overlays)) return [];
  const deltaX = Number(dx);
  const deltaY = Number(dy);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return overlays;
  return overlays.map(o => {
    if (!o || o.id !== id) return o;
    if (o.locked) return o;
    return { ...o, x: (o.x || 0) + deltaX, y: (o.y || 0) + deltaY };
  });
};

export const reorderOverlaysById = (overlays, fromId, toId) => {
  if (!Array.isArray(overlays)) return [];
  if (!fromId || !toId || fromId === toId) return overlays;

  const fromIndex = overlays.findIndex(o => o && o.id === fromId);
  const toIndex = overlays.findIndex(o => o && o.id === toId);
  if (fromIndex < 0 || toIndex < 0) return overlays;

  const next = overlays.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};
