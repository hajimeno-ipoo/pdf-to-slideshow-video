import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('glass prefs: util defines storage key and defaults', () => {
  const src = readUtf8('utils/glassPrefs.ts');
  assert.ok(src.includes('GLASS_PREFS_STORAGE_KEY'));
  assert.ok(src.includes("pdfVideo_glassPrefs_v1"));
  assert.ok(src.includes('DEFAULT_GLASS_PREFS'));
  assert.ok(src.includes("tintHex"));
  assert.ok(src.includes("opacity"));
});

test('glass prefs: App applies idle glass css vars and mounts modal', () => {
  const src = readUtf8('App.tsx');
  assert.ok(src.includes('computeIdleGlassCssVars(glassPrefs)'));
  assert.ok(src.includes('style={idleGlassCssVars'));
  assert.ok(src.includes('<GlassSettingsModal'));
  assert.ok(src.includes('onOpenGlassSettings'));
});

test('glass prefs: Header has glass settings button hook', () => {
  const src = readUtf8('components/Header.tsx');
  assert.ok(src.includes('onOpenGlassSettings'));
  assert.ok(src.includes('aria-label="ガラス設定"'));
});

test('glass prefs: idle overlay styles exist', () => {
  const css = readUtf8('index.css');
  assert.ok(css.includes('.glass-settings-overlay'));
  assert.ok(css.includes('.glass-settings-panel'));
});

