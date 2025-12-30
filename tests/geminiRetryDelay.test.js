import test from 'node:test';
import assert from 'node:assert/strict';

import { getGeminiRetryDelayMs } from '../utils/geminiRetryDelay.js';

test('getGeminiRetryDelayMs: returns ms from error.error.details retryDelay', () => {
  const err = {
    error: {
      details: [
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '54s' }
      ]
    }
  };
  assert.equal(getGeminiRetryDelayMs(err, ''), 54000);
});

test('getGeminiRetryDelayMs: supports decimal seconds and rounds up', () => {
  const err = { error: { details: [{ retryDelay: '54.09444643s' }] } };
  assert.equal(getGeminiRetryDelayMs(err, ''), 54095);
});

test('getGeminiRetryDelayMs: returns ms from top-level error.details', () => {
  const err = { details: [{ retryDelay: '1.2s' }] };
  assert.equal(getGeminiRetryDelayMs(err, ''), 1200);
});

test('getGeminiRetryDelayMs: ignores invalid retryDelay values and falls back to message', () => {
  const err = { error: { details: [{ retryDelay: '' }, { retryDelay: '0s' }, { retryDelay: 'nope' }] } };
  const msg = '... retryDelay\":\"2s\" ...';
  assert.equal(getGeminiRetryDelayMs(err, msg), 2000);
});

test('getGeminiRetryDelayMs: parses "Please retry in Xs" from message', () => {
  const msg = 'You exceeded your current quota. Please retry in 3.5s.';
  assert.equal(getGeminiRetryDelayMs(null, msg), 3500);
});

test('getGeminiRetryDelayMs: treats non-string fallbackMessage as empty string', () => {
  assert.equal(getGeminiRetryDelayMs({}, 123), null);
});

test('getGeminiRetryDelayMs: ignores non-finite seconds from details and falls back to message', () => {
  const err = { error: { details: [{ retryDelay: `${'9'.repeat(400)}s` }] } };
  const msg = '... retryDelay\":\"2s\" ...';
  assert.equal(getGeminiRetryDelayMs(err, msg), 2000);
});

test('getGeminiRetryDelayMs: returns null when no retry delay found', () => {
  assert.equal(getGeminiRetryDelayMs({}, 'nope'), null);
  assert.equal(getGeminiRetryDelayMs({ error: { details: [] } }, ''), null);
  assert.equal(getGeminiRetryDelayMs({ error: { details: [{ retryDelay: 123 }] } }, ''), null);
});
