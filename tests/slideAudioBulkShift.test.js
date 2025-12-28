import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applySlideAudioOffsetDelta } from '../utils/slideAudioBulkShift.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('applySlideAudioOffsetDelta: non-array -> []', () => {
  assert.deepEqual(applySlideAudioOffsetDelta(null, 1.5), []);
});

test('applySlideAudioOffsetDelta: invalid/zero delta -> original ref', () => {
  const slides = [{ id: '1', duration: 3, audioFile: { name: 'a' }, audioOffset: 0 }];
  assert.strictEqual(applySlideAudioOffsetDelta(slides, Number.NaN), slides);
  assert.strictEqual(applySlideAudioOffsetDelta(slides, 0), slides);
});

test('applySlideAudioOffsetDelta: shifts only slides with audioFile', () => {
  const s1 = { id: '1', duration: 3, audioFile: { name: 'a' }, audioOffset: 0.5 };
  const s2 = { id: '2', duration: 3, audioOffset: 0.25 };
  const slides = [s1, s2];

  const updated = applySlideAudioOffsetDelta(slides, 1.5);
  assert.notStrictEqual(updated, slides);
  assert.equal(updated[0].audioOffset, 2.0);
  assert.equal(updated[0].duration, 3);
  assert.strictEqual(updated[1], s2);
});

test('applySlideAudioOffsetDelta: extendDuration adds applied shift (clamp-aware)', () => {
  const slides = [{ id: '1', duration: 3, audioFile: { name: 'a' }, audioOffset: 0 }];
  const updated = applySlideAudioOffsetDelta(slides, 1.5, { extendDuration: true });
  assert.equal(updated[0].audioOffset, 1.5);
  assert.equal(updated[0].duration, 4.5);
});

test('applySlideAudioOffsetDelta: negative delta clamps at 0 and does not extend', () => {
  const slides = [{ id: '1', duration: 3, audioFile: { name: 'a' }, audioOffset: 0.3 }];
  const updated = applySlideAudioOffsetDelta(slides, -1, { extendDuration: true });
  assert.equal(updated[0].audioOffset, 0);
  assert.equal(updated[0].duration, 3);
});

test('Toolbar global settings: motion bulk-apply is removed', async () => {
  const src = await fs.readFile(path.join(repoRoot, 'components/slideEditor/Toolbar.tsx'), 'utf8');
  assert.ok(!src.includes('モーション'));
  assert.ok(!src.includes('Ken Burns'));
});

