import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('idle range: index.css defines WebKit progress fill via CSS variable', () => {
  const css = readUtf8('index.css');
  assert.ok(css.includes('--idle-range-progress'));
  assert.ok(css.includes('::-webkit-slider-runnable-track'));
  assert.ok(css.includes('linear-gradient'));
});

test('idle range: App updates --idle-range-progress for idle-range inputs', () => {
  const src = readUtf8('App.tsx');
  assert.ok(src.includes("'--idle-range-progress'"));
  assert.ok(src.includes('input[type="range"].idle-range'));
});

test('idle range: SlideEditor SettingsPanel opts in to idle-range', () => {
  const src = readUtf8('components/slideEditor/SettingsPanel.tsx');
  assert.ok(src.includes('w-full idle-range'));
  assert.ok(src.includes('w-24 idle-range'));
});

