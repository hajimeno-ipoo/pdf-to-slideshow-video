import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('crop UI: guides toggle + aspect presets exist', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('setCropGuidesEnabled'));
  assert.ok(src.includes('handleSelectCropAspectPreset'));
  assert.ok(src.includes('デフォルト'));
  assert.ok(src.includes('16:9'));
  assert.ok(src.includes('4:3'));
  assert.ok(src.includes('1:1'));
  assert.ok(src.includes('9:16'));
  assert.ok(src.includes('フリー'));
  assert.ok(src.includes('ガイド線'));
  assert.ok(!src.includes('※ Shift'));
});

test('crop guides: uses outlined frame-colored lines for visibility', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('border-emerald-400/70'));
  assert.ok(src.includes('drop-shadow'));
});

test('crop handles: includes side handles (n/s/e/w)', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes("handleMouseDownCrop(e, 'n')"));
  assert.ok(src.includes("handleMouseDownCrop(e, 's')"));
  assert.ok(src.includes("handleMouseDownCrop(e, 'e')"));
  assert.ok(src.includes("handleMouseDownCrop(e, 'w')"));
});
