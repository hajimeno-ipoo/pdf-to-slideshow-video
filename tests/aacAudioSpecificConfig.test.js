import test from 'node:test';
import assert from 'node:assert/strict';
import { createAacLcAudioSpecificConfig } from '../utils/aacAudioSpecificConfig.js';

test('createAacLcAudioSpecificConfig: 44100Hz stereo', () => {
  const result = createAacLcAudioSpecificConfig(44100, 2);
  assert.deepEqual(Array.from(result), [0x12, 0x10]);
});

test('createAacLcAudioSpecificConfig: 48000Hz stereo', () => {
  const result = createAacLcAudioSpecificConfig(48000, 2);
  assert.deepEqual(Array.from(result), [0x11, 0x90]);
});

test('createAacLcAudioSpecificConfig: invalid sampleRate throws', () => {
  assert.throws(() => createAacLcAudioSpecificConfig(0, 2));
  assert.throws(() => createAacLcAudioSpecificConfig(Number.NaN, 2));
  assert.throws(() => createAacLcAudioSpecificConfig('nope', 2));
});

test('createAacLcAudioSpecificConfig: unsupported sampleRate throws', () => {
  assert.throws(() => createAacLcAudioSpecificConfig(12345, 2));
});

test('createAacLcAudioSpecificConfig: invalid channels throws', () => {
  assert.throws(() => createAacLcAudioSpecificConfig(44100, 0));
  assert.throws(() => createAacLcAudioSpecificConfig(44100, 8));
  assert.throws(() => createAacLcAudioSpecificConfig(44100, Number.NaN));
});

