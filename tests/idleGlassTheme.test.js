import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('idle screen theme: index.css defines scoped glass styles', () => {
  const css = readUtf8('index.css');

  assert.ok(css.includes('.screen-idle'));
  assert.ok(css.includes('.glass-thin'));
  assert.ok(css.includes('.glass-strong'));
  assert.ok(css.includes('.idle-range'));
  assert.ok(css.includes('.idle-sidebar-typography'));
  assert.ok(css.includes('--idle-text-primary'));
  assert.ok(css.includes('backdrop-filter'));
  assert.ok(css.includes('-webkit-backdrop-filter'));
  assert.ok(css.includes('glass-distortion'));
});

test('idle screen theme: index.html defines glass-distortion filter', () => {
  const html = readUtf8('index.html');
  assert.ok(html.includes('id="glass-distortion"'));
});

test('idle screen theme: App uses screen-idle and idle-surface', () => {
  const src = readUtf8('App.tsx');
  assert.ok(src.includes("isIdle ? 'screen-idle'"));
  assert.ok(src.includes("isIdle ? 'idle-surface' : ''"));
});

test('idle screen theme: FileUpload uses glass + blue drag state', () => {
  const src = readUtf8('components/FileUpload.tsx');
  assert.ok(src.includes('glass-strong'));
  assert.ok(src.includes('border-blue-500'));
  assert.ok(src.includes('group-hover:text-blue-600'));
  assert.ok(!src.includes('(ベータ版)'));
  assert.ok(!src.includes('Gemini 2.5'));
  assert.ok(src.includes('text-red-500'));
});

test('idle screen theme: sidebar panels opt-in to idle typography', () => {
  const projectSettings = readUtf8('components/ProjectSettings.tsx');
  const inspector = readUtf8('components/SlideInspector.tsx');

  assert.ok(projectSettings.includes('idle-sidebar-typography'));
  assert.ok(inspector.includes('idle-sidebar-typography'));
});

test('idle screen theme: editor cards opt-in to idle typography', () => {
  const slideEditor = readUtf8('components/SlideEditor.tsx');
  assert.ok(slideEditor.includes('idle-sidebar-typography'));
});
