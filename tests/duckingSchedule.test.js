import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDuckingIntervals } from '../utils/duckingSchedule.js';

test('buildDuckingIntervals: non-array -> []', () => {
  assert.deepEqual(buildDuckingIntervals(null, 10), []);
});

test('buildDuckingIntervals: empty -> []', () => {
  assert.deepEqual(buildDuckingIntervals([], 10), []);
});

test('buildDuckingIntervals: filters invalid segments', () => {
  const result = buildDuckingIntervals(
    [
      null,
      { start: Number.NaN, end: 2 },
      { start: 1, end: Number.POSITIVE_INFINITY },
      { start: 2, end: 2 },
      { start: 3, end: 2 },
      { start: 1, end: 2 }
    ],
    10
  );
  assert.deepEqual(result, [{ start: 1, end: 2 }]);
});

test('buildDuckingIntervals: applies lead/tail and clamps to duration', () => {
  const result = buildDuckingIntervals([{ start: 1, end: 2 }], 2.3, {
    lead: 0.5,
    tail: 0.5
  });
  assert.deepEqual(result, [{ start: 0.5, end: 2.3 }]);
});

test('buildDuckingIntervals: duration invalid -> no clamp', () => {
  const result = buildDuckingIntervals([{ start: 1, end: 2 }], Number.NaN, {
    tail: 1
  });
  assert.deepEqual(result, [{ start: 1, end: 3 }]);
});

test('buildDuckingIntervals: duration<=0 treated as Infinity', () => {
  const result = buildDuckingIntervals([{ start: 1, end: 2 }], 0, { tail: 1 });
  assert.deepEqual(result, [{ start: 1, end: 3 }]);
});

test('buildDuckingIntervals: option NaN treated as 0', () => {
  const result = buildDuckingIntervals([{ start: 1, end: 2 }], 10, {
    lead: Number.NaN,
    tail: Number.NaN,
    mergeGap: Number.NaN
  });
  assert.deepEqual(result, [{ start: 1, end: 2 }]);
});

test('buildDuckingIntervals: segment beyond duration dropped', () => {
  const result = buildDuckingIntervals([{ start: 11, end: 12 }], 10);
  assert.deepEqual(result, []);
});

test('buildDuckingIntervals: merges overlap and small gaps', () => {
  const result = buildDuckingIntervals(
    [
      { start: 0, end: 1 },
      { start: 0.8, end: 2 },
      { start: 2.1, end: 3 }
    ],
    10,
    { mergeGap: 0.2 }
  );
  assert.deepEqual(result, [{ start: 0, end: 3 }]);
});

test('buildDuckingIntervals: negative options treated as 0', () => {
  const result = buildDuckingIntervals(
    [
      { start: 1, end: 2 },
      { start: 2.1, end: 3 }
    ],
    10,
    { lead: -1, tail: -1, mergeGap: -1 }
  );
  assert.deepEqual(result, [
    { start: 1, end: 2 },
    { start: 2.1, end: 3 }
  ]);
});
