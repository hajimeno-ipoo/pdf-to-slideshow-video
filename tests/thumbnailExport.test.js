import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildThumbnailCaptureTimes,
  clampSeconds,
  formatSecondsForFilename
} from '../utils/thumbnailExport.js';

test('clampSeconds: NaN -> 0', () => {
  assert.equal(clampSeconds(Number.NaN, 10), 0);
});

test('clampSeconds: duration invalid clamps only to >=0', () => {
  assert.equal(clampSeconds(-5, Number.NaN), 0);
  assert.equal(clampSeconds(5, 0), 5);
});

test('clampSeconds: clamps to [0,duration]', () => {
  assert.equal(clampSeconds(-1, 10), 0);
  assert.equal(clampSeconds(11, 10), 10);
  assert.equal(clampSeconds(2.5, 10), 2.5);
});

test('formatSecondsForFilename: rounds to 1 decimal and replaces dot', () => {
  assert.equal(formatSecondsForFilename(12), '12');
  assert.equal(formatSecondsForFilename(12.04), '12');
  assert.equal(formatSecondsForFilename(12.05), '12_1');
  assert.equal(formatSecondsForFilename(0.3), '0_3');
});

test('buildThumbnailCaptureTimes: maxFrames<=1 -> single time', () => {
  assert.deepEqual(buildThumbnailCaptureTimes(2, 9, 10, 1), [2]);
});

test('buildThumbnailCaptureTimes: maxFrames NaN -> single time', () => {
  assert.deepEqual(buildThumbnailCaptureTimes(2, 9, 10, Number.NaN), [2]);
});

test('buildThumbnailCaptureTimes: end<=start -> single time', () => {
  assert.deepEqual(buildThumbnailCaptureTimes(5, 5, 10, 20), [5]);
  assert.deepEqual(buildThumbnailCaptureTimes(6, 5, 10, 20), [6]);
});

test('buildThumbnailCaptureTimes: returns 20 times with first/last exact', () => {
  const times = buildThumbnailCaptureTimes(0, 10, 100, 20);
  assert.equal(times.length, 20);
  assert.equal(times[0], 0);
  assert.equal(times[times.length - 1], 10);
});

test('buildThumbnailCaptureTimes: clamps to duration', () => {
  const times = buildThumbnailCaptureTimes(0, 999, 5, 20);
  assert.equal(times[0], 0);
  assert.equal(times[times.length - 1], 5);
});

test('buildThumbnailCaptureTimes: deduplicates when rounding creates duplicates', () => {
  const times = buildThumbnailCaptureTimes(0, 0.0004, 10, 20);
  assert.ok(times.length < 20);
  assert.equal(times[0], 0);
  assert.equal(times[times.length - 1], 0.0004);
});
