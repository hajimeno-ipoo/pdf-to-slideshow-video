import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyUploadFiles } from '../utils/uploadSource.js';

test('classifyUploadFiles: empty -> error', () => {
  assert.deepEqual(classifyUploadFiles(null), { kind: 'error', message: 'ファイルが選ばれてないよ。' });
  assert.deepEqual(classifyUploadFiles([]), { kind: 'error', message: 'ファイルが選ばれてないよ。' });
});

test('classifyUploadFiles: pdf (type) -> pdf', () => {
  const result = classifyUploadFiles([{ name: 'a.pdf', type: 'application/pdf' }]);
  assert.equal(result.kind, 'pdf');
  assert.equal(result.pdfFile.name, 'a.pdf');
});

test('classifyUploadFiles: pdf (ext) -> pdf', () => {
  const result = classifyUploadFiles([{ name: 'A.PDF', type: '' }]);
  assert.equal(result.kind, 'pdf');
  assert.equal(result.pdfFile.name, 'A.PDF');
});

test('classifyUploadFiles: multiple pdf -> error', () => {
  const result = classifyUploadFiles([
    { name: 'a.pdf', type: 'application/pdf' },
    { name: 'b.pdf', type: 'application/pdf' },
  ]);
  assert.deepEqual(result, { kind: 'error', message: 'PDFは1つだけ選んでね。' });
});

test('classifyUploadFiles: images -> images', () => {
  const result = classifyUploadFiles([
    { name: 'a.png', type: 'image/png' },
    { name: 'b.jpeg', type: 'image/jpeg' },
    { name: 'c.gif', type: '' },
    { name: 'd.webp', type: '' },
  ]);
  assert.equal(result.kind, 'images');
  assert.equal(result.imageFiles.length, 4);
});

test('classifyUploadFiles: mixed pdf + images -> error', () => {
  const result = classifyUploadFiles([
    { name: 'a.pdf', type: 'application/pdf' },
    { name: 'b.png', type: 'image/png' },
  ]);
  assert.deepEqual(result, { kind: 'error', message: 'PDFと画像は一緒に選べないよ。どっちかだけにしてね。' });
});

test('classifyUploadFiles: unsupported -> error', () => {
  const result = classifyUploadFiles([{ name: 'a.txt', type: 'text/plain' }]);
  assert.deepEqual(result, { kind: 'error', message: 'PDFか画像（PNG/JPEG/GIF/WebP）を選んでね。' });
});

