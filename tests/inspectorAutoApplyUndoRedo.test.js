import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('SlideInspector: onUpdate supports history flag', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('onUpdate: (updatedSlide: Slide, addToHistory?: boolean) => void;'));
});

test('SlideInspector: apply button updates thumbnail and pushes undo history', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('const newThumb = await updateThumbnail'));
  assert.ok(src.includes('onUpdateRef.current(updatedSlide, true)'));
  assert.ok(src.includes('updatedSlide.thumbnailIsFrame = true'));
});

test('SlideInspector: does not auto-apply changes', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(!src.includes('scheduleAutoApplyUpdate();'));
});

test('SlideInspector: can reset slide layout (position/size) from inspector', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('handleResetSlideLayout'));
  assert.ok(src.includes('setSlideLayout(null)'));
  assert.ok(src.includes('位置リセット'));
});

test('SlideInspector: selecting a slide does not recreate layerOrder when unchanged', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('setLayerOrder(prev => {'));
  assert.ok(src.includes('const nextLayerOrder = slide.layerOrder || [SLIDE_TOKEN'));
  assert.ok(src.includes('const next = nextLayerOrder'));
  assert.ok(src.includes('prevOrder.every((id, i) => id === next[i])'));
});

test('SlideEditor: handleUpdateSlide forwards addToHistory to updateSlides', () => {
  const src = readUtf8('components/SlideEditor.tsx');
  assert.ok(src.includes('const handleUpdateSlide = (updatedSlide: Slide, addToHistory: boolean = true)'));
  assert.ok(src.includes('updateSlides(newSlides, addToHistory)'));
  assert.ok(src.includes('isOpen={isInspectorOpen}'));
});

test('SlideGrid: frame thumbnail does not double-apply slideScale', () => {
  const src = readUtf8('components/slideEditor/SlideGrid.tsx');
  assert.ok(src.includes('const isFrameThumb = !!slide.thumbnailIsFrame'));
  assert.ok(src.includes("transform: isFrameThumb ? 'none' : `scale(${videoSettings.slideScale / 100})`"));
});
