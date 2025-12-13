import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureWritePermission,
  getVideoSaveFilePickerOptions,
  isFileSystemAccessSupported
} from '../utils/fileSystemAccess.js';

test('isFileSystemAccessSupported: false for null', () => {
  assert.equal(isFileSystemAccessSupported(null), false);
});

test('isFileSystemAccessSupported: false for insecure context', () => {
  assert.equal(
    isFileSystemAccessSupported({ isSecureContext: false, showSaveFilePicker() {} }),
    false
  );
});

test('isFileSystemAccessSupported: false when picker missing', () => {
  assert.equal(isFileSystemAccessSupported({ isSecureContext: true }), false);
});

test('isFileSystemAccessSupported: true when supported', () => {
  assert.equal(
    isFileSystemAccessSupported({ isSecureContext: true, showSaveFilePicker() {} }),
    true
  );
});

test('getVideoSaveFilePickerOptions: mp4', () => {
  const opts = getVideoSaveFilePickerOptions('mp4');
  assert.equal(opts.suggestedName, 'slideshow.mp4');
  assert.deepEqual(opts.types?.[0]?.accept, { 'video/mp4': ['.mp4'] });
});

test('getVideoSaveFilePickerOptions: mov', () => {
  const opts = getVideoSaveFilePickerOptions('mov');
  assert.equal(opts.suggestedName, 'slideshow.mov');
  assert.deepEqual(opts.types?.[0]?.accept, { 'video/quicktime': ['.mov'] });
});

test('ensureWritePermission: false for null', async () => {
  assert.equal(await ensureWritePermission(null), false);
});

test('ensureWritePermission: queryPermission granted', async () => {
  const handle = {
    queryPermission: async () => 'granted'
  };
  assert.equal(await ensureWritePermission(handle), true);
});

test('ensureWritePermission: requestPermission granted after prompt', async () => {
  const handle = {
    queryPermission: async () => 'prompt',
    requestPermission: async () => 'granted'
  };
  assert.equal(await ensureWritePermission(handle), true);
});

test('ensureWritePermission: requestPermission denied', async () => {
  const handle = {
    requestPermission: async () => 'denied'
  };
  assert.equal(await ensureWritePermission(handle), false);
});

test('ensureWritePermission: no permission APIs -> true', async () => {
  assert.equal(await ensureWritePermission({}), true);
});

test('ensureWritePermission: throws -> false', async () => {
  const handle = {
    queryPermission: async () => {
      throw new Error('boom');
    }
  };
  assert.equal(await ensureWritePermission(handle), false);
});

