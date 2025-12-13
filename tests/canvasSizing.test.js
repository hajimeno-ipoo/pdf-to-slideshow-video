import test from 'node:test';
import assert from 'node:assert/strict';

import { getCanvasRenderWidthCss } from '../utils/canvasSizing.js';

test('getCanvasRenderWidthCss: invalid desired -> 1', () => {
  assert.equal(getCanvasRenderWidthCss(Number.NaN, 2), 1);
});

test('getCanvasRenderWidthCss: desired <= 0 -> 1', () => {
  assert.equal(getCanvasRenderWidthCss(0, 2), 1);
  assert.equal(getCanvasRenderWidthCss(-10, 2), 1);
});

test('getCanvasRenderWidthCss: caps by maxDevicePixels/dpr', () => {
  assert.equal(getCanvasRenderWidthCss(99999, 2, 1000), 500);
});

test('getCanvasRenderWidthCss: dpr invalid treated as 1', () => {
  assert.equal(getCanvasRenderWidthCss(200, Number.NaN, 100), 100);
});

test('getCanvasRenderWidthCss: maxDevicePixels invalid treated as default', () => {
  assert.equal(getCanvasRenderWidthCss(20000, 1, Number.NaN), 16384);
  assert.equal(getCanvasRenderWidthCss(20000, 2, 0), 8192);
});

test('getCanvasRenderWidthCss: returns desired when within cap', () => {
  assert.equal(getCanvasRenderWidthCss(500, 2, 2000), 500);
});

