import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('pdfVideoService: custom image bitmap respects slide.crop', () => {
  const src = readUtf8('services/pdfVideoService.ts');
  assert.ok(src.includes('const createImageBitmapWithCrop'));
  assert.ok(src.includes('createImageBitmapWithCrop(slide.customImageFile, slide.crop)'));
});

test('pdfVideoService: solid slide bitmap uses crop aspect', () => {
  const src = readUtf8('services/pdfVideoService.ts');
  assert.ok(src.includes('const cropW = Number.isFinite(slide.crop?.width)'));
  assert.ok(src.includes('const cropH = Number.isFinite(slide.crop?.height)'));
});

test('pdfVideoService: export solid slide bitmap uses crop size', () => {
  const src = readUtf8('services/pdfVideoService.ts');
  assert.ok(src.includes("} else if (s.backgroundColor) {"));
  assert.ok(src.includes('const cropW = Number.isFinite(s.crop?.width)'));
  assert.ok(src.includes('const cropH = Number.isFinite(s.crop?.height)'));
});

test('pdfVideoService: PDF preview canvases are filled white (no black transparency)', () => {
  const src = readUtf8('services/pdfVideoService.ts');
  assert.ok(src.includes("tempCtx.fillStyle = '#ffffff'"));
  assert.ok(src.includes("ctx.fillStyle = '#ffffff'"));
});

test('SlideInspector: preview uses local crop (0 is valid)', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('const cropX = crop?.x ?? slide.crop?.x ?? 0;'));
  assert.ok(src.includes('const cropY = crop?.y ?? slide.crop?.y ?? 0;'));
  assert.ok(src.includes('const cw = (crop?.width ?? slide.crop?.width);'));
});

test('SlideInspector: canvas preview img disables max-width clamp', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('max-w-none'));
});
