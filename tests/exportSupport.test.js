import test from 'node:test';
import assert from 'node:assert/strict';
import { getExportSupportError } from '../utils/exportSupport.js';

test('getExportSupportError returns general error when window is missing', () => {
  const message = getExportSupportError(null, { requireAudio: false });
  assert.equal(
    message,
    'このブラウザでは動画の書き出しができないよ。対応ブラウザで開いてね。'
  );
});

test('getExportSupportError returns null when video export is supported', () => {
  const win = {
    OffscreenCanvas() {},
    VideoEncoder() {}
  };
  const message = getExportSupportError(win, { requireAudio: false });
  assert.equal(message, null);
});

test('getExportSupportError returns audio-specific error when audio is required', () => {
  const win = {
    OffscreenCanvas() {},
    VideoEncoder() {}
  };
  const message = getExportSupportError(win, { requireAudio: true });
  assert.equal(
    message,
    'このブラウザでは音あり動画の書き出しができないよ。音を外すか別のブラウザで開いてね。'
  );
});

test('getExportSupportError returns general error when video encoder is missing', () => {
  const win = {
    OffscreenCanvas() {}
  };
  const message = getExportSupportError(win, { requireAudio: false });
  assert.equal(
    message,
    'このブラウザでは動画の書き出しができないよ。対応ブラウザで開いてね。'
  );
});
