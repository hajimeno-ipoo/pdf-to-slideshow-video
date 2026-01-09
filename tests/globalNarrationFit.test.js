import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GLOBAL_NARRATION_DURATION_BASE_KEY,
  fitSlidesToGlobalNarrationDuration,
  restoreSlidesFromGlobalNarrationFit,
} from '../utils/globalNarrationFit.js';

const sumDurations = (slides) => {
  const sum = slides.reduce((acc, s) => acc + (Number(s?.duration) || 0), 0);
  return Math.round(sum * 1e12) / 1e12;
};

test('fitSlidesToGlobalNarrationDuration: non-array -> []', () => {
  assert.deepEqual(fitSlidesToGlobalNarrationDuration(null, 1), []);
});

test('fitSlidesToGlobalNarrationDuration: empty -> same array', () => {
  const slides = [];
  assert.equal(fitSlidesToGlobalNarrationDuration(slides, 1), slides);
});

test('fitSlidesToGlobalNarrationDuration: invalid target -> unchanged', () => {
  const slides = [{ id: 'a', duration: 1 }];
  assert.equal(fitSlidesToGlobalNarrationDuration(slides, 0), slides);
  assert.equal(fitSlidesToGlobalNarrationDuration(slides, NaN), slides);
});

test('fitSlidesToGlobalNarrationDuration: too short target -> clamps to min and stores base', () => {
  const slides = [
    { id: 'a', duration: 1 },
    { id: 'b', duration: 2 },
    { id: 'c', duration: 3 },
  ];
  const fitted = fitSlidesToGlobalNarrationDuration(slides, 0.05); // < 0.1s * 3

  assert.equal(fitted.length, 3);
  assert.equal(fitted[0].duration, 0.1);
  assert.equal(fitted[1].duration, 0.1);
  assert.equal(fitted[2].duration, 0.1);

  assert.equal(fitted[0][GLOBAL_NARRATION_DURATION_BASE_KEY], 1);
  assert.equal(fitted[1][GLOBAL_NARRATION_DURATION_BASE_KEY], 2);
  assert.equal(fitted[2][GLOBAL_NARRATION_DURATION_BASE_KEY], 3);
});

test('fitSlidesToGlobalNarrationDuration: ratio preserved and sum matches (remaining == 0 case)', () => {
  const slides = [
    { id: 'a', duration: 1 },
    { id: 'b', duration: 1 },
  ];
  const fitted = fitSlidesToGlobalNarrationDuration(slides, 0.4); // targetTicks=40, minTotal=20, extraTotal=20 (divides evenly)
  assert.equal(fitted[0].duration, 0.2);
  assert.equal(fitted[1].duration, 0.2);
  assert.equal(sumDurations(fitted), 0.4);
});

test('fitSlidesToGlobalNarrationDuration: ratio preserved and sum matches (remaining > 0 case)', () => {
  const slides = [
    { id: 'a', duration: 1 },
    { id: 'b', duration: 3 },
  ];
  const target = 1.23;
  const fitted = fitSlidesToGlobalNarrationDuration(slides, target);

  // Sum matches target rounded to 0.01s (default tick)
  assert.equal(sumDurations(fitted), 1.23);

  // Ratio roughly follows 1:3 (0.31 : 0.92 in ticks)
  assert.equal(fitted[0].duration + fitted[1].duration, 1.23);
  assert.equal(fitted[0].duration, 0.31);
  assert.equal(fitted[1].duration, 0.92);
});

test('fitSlidesToGlobalNarrationDuration: keeps existing base and uses it for re-fit', () => {
  const first = fitSlidesToGlobalNarrationDuration(
    [
      { id: 'a', duration: 1 },
      { id: 'b', duration: 3 },
    ],
    4
  );

  // Simulate user editing durations after fit (but base remains)
  const edited = first.map((s) => ({ ...s, duration: 10 }));
  const refit = fitSlidesToGlobalNarrationDuration(edited, 2);

  assert.equal(refit[0][GLOBAL_NARRATION_DURATION_BASE_KEY], 1);
  assert.equal(refit[1][GLOBAL_NARRATION_DURATION_BASE_KEY], 3);
  assert.equal(refit[0].duration, 0.5);
  assert.equal(refit[1].duration, 1.5);
  assert.equal(sumDurations(refit), 2);
});

test('fitSlidesToGlobalNarrationDuration: option fallbacks (invalid tick/min)', () => {
  const slides = [
    { id: 'a', duration: 1 },
    { id: 'b', duration: 3 },
  ];
  const fitted = fitSlidesToGlobalNarrationDuration(slides, 2, { tickSeconds: 0, minSeconds: -1 });
  assert.equal(sumDurations(fitted), 2);
  assert.ok(fitted.every((s) => s.duration >= 0.1));
  assert.ok(fitted.every((s) => Math.round(s.duration * 100) === s.duration * 100)); // 0.01s ticks
});

test('fitSlidesToGlobalNarrationDuration: targetTicks<=0 in rounding -> minTicks*tick', () => {
  const slides = [
    { id: 'a', duration: 1 },
    { id: 'b', duration: 1 },
  ];
  const fitted = fitSlidesToGlobalNarrationDuration(slides, 0.1, { tickSeconds: 1, minSeconds: 0.1 });
  assert.equal(fitted[0].duration, 1);
  assert.equal(fitted[1].duration, 1);
  assert.equal(fitted[0][GLOBAL_NARRATION_DURATION_BASE_KEY], 1);
});

test('fitSlidesToGlobalNarrationDuration: clamps tiny slide and triggers tick removal path', () => {
  const slides = [
    { id: 'a', duration: 0.01 },
    { id: 'b', duration: 5 },
    { id: 'c', duration: 4 },
  ];

  const fitted = fitSlidesToGlobalNarrationDuration(slides, 0.73, { tickSeconds: 0.07, minSeconds: 0.1 });

  // targetSeconds(0.73) rounds to 10 ticks => 0.7s total
  assert.equal(sumDurations(fitted), 0.7);
  // minTicks is 2 (0.14s) so the tiny slide becomes 0.14
  assert.equal(Math.round(fitted[0].duration * 100) / 100, 0.14);
  // one of the larger slides should have been reduced by 1 tick (0.07) to match targetTicks
  assert.equal(Math.round(fitted[2].duration * 100) / 100, 0.21);
});

test('fitSlidesToGlobalNarrationDuration: invalid slide.duration falls back to minSeconds', () => {
  const slides = [
    { id: 'a', duration: 0 },
    { id: 'b', duration: 1 },
  ];
  const fitted = fitSlidesToGlobalNarrationDuration(slides, 1.1);
  assert.equal(fitted[0][GLOBAL_NARRATION_DURATION_BASE_KEY], 0.1);
  assert.equal(sumDurations(fitted), 1.1);
});

test('restoreSlidesFromGlobalNarrationFit: restores and removes base key', () => {
  const fitted = fitSlidesToGlobalNarrationDuration([{ id: 'a', duration: 2 }], 1);
  assert.ok(GLOBAL_NARRATION_DURATION_BASE_KEY in fitted[0]);

  const restored = restoreSlidesFromGlobalNarrationFit(fitted);
  assert.equal(restored[0].duration, 2);
  assert.equal(GLOBAL_NARRATION_DURATION_BASE_KEY in restored[0], false);
});

test('restoreSlidesFromGlobalNarrationFit: non-array/empty', () => {
  assert.deepEqual(restoreSlidesFromGlobalNarrationFit(null), []);
  const slides = [];
  assert.equal(restoreSlidesFromGlobalNarrationFit(slides), slides);
});

test('restoreSlidesFromGlobalNarrationFit: no base -> returns original slide', () => {
  const slide = { id: 'a', duration: 2 };
  const restored = restoreSlidesFromGlobalNarrationFit([slide]);
  assert.equal(restored[0], slide);
});

test('baseKey option: fit + restore use custom key', () => {
  const baseKey = 'myBaseKey';
  const fitted = fitSlidesToGlobalNarrationDuration(
    [
      { id: 'a', duration: 1 },
      { id: 'b', duration: 2 },
    ],
    3,
    { baseKey }
  );
  assert.equal(fitted[0][baseKey], 1);
  assert.equal(fitted[1][baseKey], 2);
  assert.equal(GLOBAL_NARRATION_DURATION_BASE_KEY in fitted[0], false);

  const restored = restoreSlidesFromGlobalNarrationFit(fitted, { baseKey });
  assert.equal(restored[0].duration, 1);
  assert.equal(baseKey in restored[0], false);
});
