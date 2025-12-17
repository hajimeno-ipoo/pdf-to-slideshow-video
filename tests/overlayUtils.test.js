import test from 'node:test';
import assert from 'node:assert/strict';

import { toggleOverlayHidden, toggleOverlayLocked, deleteOverlayById, nudgeOverlayById, reorderOverlaysById } from '../utils/overlayUtils.js';

test('toggleOverlayHidden: non-array -> []', () => {
  assert.deepEqual(toggleOverlayHidden(null, 'a'), []);
});

test('toggleOverlayHidden: toggles', () => {
  const overlays = [{ id: 'a', hidden: false }, { id: 'b' }];
  assert.deepEqual(toggleOverlayHidden(overlays, 'a')[0].hidden, true);
  assert.deepEqual(toggleOverlayHidden(overlays, 'b')[1].hidden, true);
});

test('toggleOverlayLocked: toggles', () => {
  const overlays = [{ id: 'a', locked: false }, { id: 'b' }];
  assert.deepEqual(toggleOverlayLocked(overlays, 'a')[0].locked, true);
  assert.deepEqual(toggleOverlayLocked(overlays, 'b')[1].locked, true);
});

test('deleteOverlayById: removes', () => {
  const overlays = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(deleteOverlayById(overlays, 'a'), [{ id: 'b' }]);
});

test('nudgeOverlayById: moves unless locked', () => {
  const overlays = [{ id: 'a', x: 0.5, y: 0.5 }, { id: 'b', x: 0, y: 0, locked: true }];
  const moved = nudgeOverlayById(overlays, 'a', 0.1, -0.2);
  assert.equal(moved[0].x, 0.6);
  assert.equal(moved[0].y, 0.3);
  const movedLocked = nudgeOverlayById(overlays, 'b', 0.1, 0.1);
  assert.equal(movedLocked[1].x, 0);
  assert.equal(movedLocked[1].y, 0);
});

test('reorderOverlaysById: moves item to target position', () => {
  const overlays = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(reorderOverlaysById(overlays, 'a', 'c').map(o => o.id), ['b', 'c', 'a']);
  assert.deepEqual(reorderOverlaysById(overlays, 'c', 'a').map(o => o.id), ['c', 'a', 'b']);
});
