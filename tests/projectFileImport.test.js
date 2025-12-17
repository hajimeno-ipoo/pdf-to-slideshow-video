import test from 'node:test';
import assert from 'node:assert/strict';

import { getProjectImportError, getProjectJsonTextError } from '../utils/projectFileImport.js';

test('getProjectImportError: null -> message', () => {
  assert.equal(getProjectImportError(null), 'ファイルが選ばれてないよ。');
});

test('getProjectImportError: empty file -> message', () => {
  assert.equal(getProjectImportError({ name: 'a.json', size: 0 }), 'ファイルが空っぽだよ。');
});

test('getProjectImportError: too large -> message', () => {
  assert.equal(
    getProjectImportError({ name: 'a.json', size: 11 }, { maxBytes: 10 }),
    'ファイルが大きすぎるよ（最大10バイトまで）。'
  );
});

test('getProjectImportError: accepts .json even if type is empty', () => {
  assert.equal(getProjectImportError({ name: 'project.json', type: '', size: 1 }), null);
});

test('getProjectImportError: accepts application/json even if name is missing', () => {
  assert.equal(getProjectImportError({ name: '', type: 'application/json', size: 1 }), null);
});

test('getProjectImportError: rejects non-json file', () => {
  assert.equal(
    getProjectImportError({ name: 'a.txt', type: 'text/plain', size: 1 }),
    'プロジェクト（.json）のファイルを選んでね。'
  );
});

test('getProjectImportError: accepts text/json', () => {
  assert.equal(getProjectImportError({ name: 'a', type: 'text/json', size: 1 }), null);
});

test('getProjectJsonTextError: empty -> message', () => {
  assert.equal(getProjectJsonTextError(''), 'ファイルが空っぽだよ。');
});

test('getProjectJsonTextError: invalid json -> message', () => {
  assert.equal(getProjectJsonTextError('{'), 'JSONの形がこわれてるっぽい…。');
});

test('getProjectJsonTextError: version missing -> message', () => {
  assert.equal(getProjectJsonTextError('{}'), 'このプロジェクトのバージョン（version=undefined）は対応してないよ。');
});

test('getProjectJsonTextError: version ok -> null', () => {
  assert.equal(getProjectJsonTextError(JSON.stringify({ version: 1 })), null);
});

test('getProjectJsonTextError: version not allowed -> message', () => {
  assert.equal(
    getProjectJsonTextError(JSON.stringify({ version: 2 }), { allowedVersions: [1] }),
    'このプロジェクトのバージョン（version=2）は対応してないよ。'
  );
});
