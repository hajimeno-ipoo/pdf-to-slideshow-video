import test from 'node:test';
import assert from 'node:assert/strict';

import { getCroppedImageLayoutPx } from '../utils/cropPreviewUtils.js';

test('getCroppedImageLayoutPx: basic crop -> layout', () => {
  const out = getCroppedImageLayoutPx({
    originalWidth: 1000,
    originalHeight: 800,
    crop: { x: 100, y: 50, width: 400, height: 200 },
    targetWidth: 800,
    targetHeight: 400,
  });

  assert.equal(out.scale, 2);
  assert.equal(out.left, -200);
  assert.equal(out.top, -100);
  assert.equal(out.width, 2000);
  assert.equal(out.height, 1600);
});

test('getCroppedImageLayoutPx: invalid original size -> uses crop size', () => {
  const out = getCroppedImageLayoutPx({
    originalWidth: 0,
    originalHeight: NaN,
    crop: { x: 10, y: 20, width: 200, height: 100 },
    targetWidth: 400,
    targetHeight: 200,
  });

  assert.equal(out.scale, 2);
  assert.equal(out.width, 400);
  assert.equal(out.height, 200);
});

test('getCroppedImageLayoutPx: zero-ish crop -> still returns finite numbers', () => {
  const out = getCroppedImageLayoutPx({
    originalWidth: 100,
    originalHeight: 50,
    crop: { x: 0, y: 0, width: 0, height: 0 },
    targetWidth: 300,
    targetHeight: 150,
  });

  assert.ok(Number.isFinite(out.scale));
  assert.ok(Number.isFinite(out.left));
  assert.ok(Number.isFinite(out.top));
  assert.ok(Number.isFinite(out.width));
  assert.ok(Number.isFinite(out.height));
});

