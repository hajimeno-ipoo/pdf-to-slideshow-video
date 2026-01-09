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
  assert.ok(src.includes("blur"));
  assert.ok(src.includes("backgroundMode"));
  assert.ok(src.includes("backgroundColorHex"));
  assert.ok(src.includes("backgroundImageDataUrl"));
  assert.ok(src.includes("backgroundImageDisplay"));
  assert.ok(src.includes("backgroundImageScale"));
  assert.ok(src.includes("backgroundImagePositionX"));
  assert.ok(src.includes("backgroundImagePositionY"));
  assert.ok(src.includes("--idle-glass-blur"));
  assert.ok(src.includes("--idle-bg-color"));
  assert.ok(src.includes("--idle-bg-image"));
  assert.ok(src.includes("--idle-bg-size"));
  assert.ok(src.includes("--idle-bg-position"));
  assert.ok(src.includes("--idle-bg-repeat"));
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
  assert.ok(src.includes('aria-label="テーマ設定"'));
});

test('glass prefs: idle overlay styles exist', () => {
  const css = readUtf8('index.css');
  assert.ok(css.includes('.glass-settings-overlay'));
  assert.ok(css.includes('.glass-settings-panel'));
});

test('idle background: css variables and background binding exist', () => {
  const css = readUtf8('index.css');
  assert.ok(css.includes('--idle-bg-color'));
  assert.ok(css.includes('--idle-bg-image'));
  assert.ok(css.includes('--idle-bg-position'));
  assert.ok(css.includes('--idle-bg-size'));
  assert.ok(css.includes('--idle-bg-repeat'));
  assert.ok(css.includes('background-color: var(--idle-bg-color)'));
  assert.ok(css.includes('background-image: var(--idle-bg-image)'));
  assert.ok(css.includes('background-position: var(--idle-bg-position)'));
  assert.ok(css.includes('background-size: var(--idle-bg-size)'));
  assert.ok(css.includes('background-repeat: var(--idle-bg-repeat)'));
});

test('glass settings modal: background controls exist', () => {
  const src = readUtf8('components/GlassSettingsModal.tsx');
  assert.ok(src.includes('backgroundMode'));
  assert.ok(src.includes('プレビュー'));
  assert.ok(src.includes('背景の色'));
  assert.ok(src.includes('画像を選ぶ'));
  assert.ok(src.includes('画像の大きさ'));
  assert.ok(src.includes('画面フィット'));
  assert.ok(src.includes('タイル'));
  assert.ok(src.includes('位置（左右）'));
  assert.ok(src.includes('位置（上下）'));
});
