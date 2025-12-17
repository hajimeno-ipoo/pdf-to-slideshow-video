import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateProjectBytes, formatBytes } from '../utils/projectMetaUtils.js';

test('estimateProjectBytes: null -> 0', () => {
  assert.equal(estimateProjectBytes(null), 0);
});

test('estimateProjectBytes: sums file sizes and strings', () => {
  const bytes = estimateProjectBytes({
    sourceFile: { size: 10 },
    bgmFile: { size: 20 },
    globalAudioFile: null,
    videoSettings: { backgroundImageFile: { size: 5 } },
    slides: [
      {
        thumbnailUrl: 'abc', // 3 chars -> 6 bytes
        narrationScript: 'x', // 1 char -> 2 bytes
        audioFile: { size: 7 },
        customImageFile: { size: 8 },
        overlays: [{ imageData: 'zz' }], // 2 chars -> 4 bytes + overhead 64
      },
    ],
  });

  assert.equal(bytes, 10 + 20 + 5 + 7 + 8 + 6 + 2 + 4 + 64);
});

test('formatBytes: invalid -> 0B', () => {
  assert.equal(formatBytes(NaN), '0B');
  assert.equal(formatBytes(-1), '0B');
});

test('formatBytes: units', () => {
  assert.equal(formatBytes(1), '1B');
  assert.equal(formatBytes(1024), '1.0KB');
  assert.equal(formatBytes(1024 * 1024), '1.0MB');
});

