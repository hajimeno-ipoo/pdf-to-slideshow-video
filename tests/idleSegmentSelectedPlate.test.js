import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('idle segment: index.css defines selected plate styles', () => {
  const css = readUtf8('index.css');
  assert.ok(css.includes('.idle-segment'));
  assert.ok(css.includes('.idle-segment-btn.is-selected'));
  assert.ok(css.includes('rgba(0, 122, 255, 0.22)'));
});

test('idle segment: Toolbar opts in via idle-segment classes', () => {
  const src = readUtf8('components/slideEditor/Toolbar.tsx');
  assert.ok(src.includes('idle-segment'));
  assert.ok(src.includes('idle-segment-btn'));
  assert.ok(src.includes('is-selected'));
});

