import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('SlideEditor: coverflow switch uses role and aria-checked', () => {
  const src = readUtf8('components/SlideEditor.tsx');
  assert.ok(src.includes('role="switch"'));
  assert.ok(src.includes("aria-checked={slideListViewMode === 'coverflow'}"));
  assert.ok(src.includes('idle-toggle-switch'));
  assert.ok(src.includes('bg-sky-600/80'));

  const css = readUtf8('index.css');
  assert.ok(css.includes('idle-toggle-switch'));
  assert.ok(css.includes('button:not(.idle-btn-primary):not(.idle-toggle-switch)'));
});

test('SlideGrid: coverflow viewMode and navigation are present', () => {
  const src = readUtf8('components/slideEditor/SlideGrid.tsx');
  assert.ok(src.includes("viewMode?: 'grid' | 'coverflow'"));
  assert.ok(src.includes("const isCoverflow = viewMode === 'coverflow'"));
  assert.ok(src.includes('min-w-0 group/select'));
  assert.ok(src.includes('snap-x snap-mandatory'));
  assert.ok(src.includes("style={{ perspective: '1200px' }}"));
  assert.ok(src.includes('inline-flex items-center gap-4'));
  assert.ok(src.includes('translateZ('));
  assert.ok(!src.includes('rotateY('));
  assert.ok(src.includes("scrollIntoView({ behavior: 'smooth', inline: 'center'"));
  assert.ok(src.includes('aria-label="前へ"'));
  assert.ok(src.includes('aria-label="次へ"'));

  assert.ok(src.includes('dataset.coverflowScrolling'));
  const css = readUtf8('index.css');
  assert.ok(css.includes('.screen-idle[data-coverflow-scrolling="true"] .editor-glass::after'));
});
