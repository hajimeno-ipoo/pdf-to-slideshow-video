import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('SlideGrid: can download a slide original image (no overlays/background)', () => {
  const src = readUtf8('components/slideEditor/SlideGrid.tsx');
  assert.ok(src.includes('handleDownloadSlideImage'));
  assert.ok(src.includes('slide.customImageFile instanceof File'));
  assert.ok(src.includes('page.getViewport({ scale: 1 })'));
  assert.ok(src.includes('page.render({ canvasContext: ctx, viewport })'));
  assert.ok(src.includes('canvas.toBlob'));
  assert.ok(src.includes('downloadBlob'));
  assert.ok(src.includes('URL.createObjectURL'));
  assert.ok(src.includes('a.download'));
  assert.ok(src.includes('⤓'));
  assert.ok(src.includes('group-hover:opacity-100'));
  assert.ok(!src.includes('renderBackground('));
  assert.ok(!src.includes('drawSlideFrame('));
  assert.ok(!src.includes('renderSlideToImage'));
});
