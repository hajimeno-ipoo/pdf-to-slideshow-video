import test from 'node:test';
import assert from 'node:assert/strict';

import { computeWaveformEnvelopeRect } from '../utils/waveformEnvelope.js';

test('computeWaveformEnvelopeRect: invalid inputs -> null', () => {
  assert.equal(computeWaveformEnvelopeRect(Number.NaN, 0.1, 10, 1), null);
  assert.equal(computeWaveformEnvelopeRect(-0.1, 0.1, Number.NaN, 1), null);
  assert.equal(computeWaveformEnvelopeRect(-0.1, 0.1, 10, 0), null);
});

test('computeWaveformEnvelopeRect: silence -> null', () => {
  assert.equal(computeWaveformEnvelopeRect(0, 0, 10, 1), null);
});

test('computeWaveformEnvelopeRect: swaps min/max if reversed', () => {
  const rect = computeWaveformEnvelopeRect(0.5, -0.5, 10, 1);
  assert.ok(rect);
  assert.ok(rect.height > 0);
});

test('computeWaveformEnvelopeRect: clamps samples to [-1,1]', () => {
  const rect = computeWaveformEnvelopeRect(-999, 999, 10, 1, { boost: 1 });
  assert.ok(rect);
  assert.equal(rect.y, 0);
  assert.equal(rect.height, 20);
});

test('computeWaveformEnvelopeRect: applies minBarHeightPx when too thin', () => {
  const rect = computeWaveformEnvelopeRect(-0.000001, 0.000001, 10, 1, {
    boost: 1,
    minBarHeightPx: 2
  });
  assert.ok(rect);
  assert.equal(rect.height, 2);
});

test('computeWaveformEnvelopeRect: minBarHeightPx invalid treated as 0', () => {
  const rect = computeWaveformEnvelopeRect(-0.000001, 0.000001, 10, 1, {
    boost: 0,
    minBarHeightPx: Number.NaN
  });
  assert.equal(rect, null);
});

test('computeWaveformEnvelopeRect: boost invalid treated as 0 -> null', () => {
  assert.equal(
    computeWaveformEnvelopeRect(-1, 1, 10, 1, { boost: Number.NaN }),
    null
  );
});
