import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('SlideInspector: onUpdate supports history flag and auto-applies edits', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('onUpdate: (updatedSlide: Slide, addToHistory?: boolean) => void;'));
  assert.ok(src.includes('emitAutoApplyUpdate'));
  assert.ok(src.includes('const addToHistory = !editSessionActiveRef.current'));
  assert.ok(src.includes('onUpdateRef.current(updatedSlide, addToHistory)'));
  assert.ok(src.includes('scheduleAutoApplyUpdate'));
  assert.ok(src.includes('scheduleThumbnailUpdate'));
  assert.ok(src.includes('skipNextAutoApplyRef'));
});

test('SlideInspector: apply button updates thumbnail without pushing undo history', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('onUpdateRef.current(updatedSlide, false)'));
});

test('SlideInspector: selecting a slide does not recreate layerOrder when unchanged', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('setLayerOrder(prev => {'));
  assert.ok(src.includes('const nextLayerOrder = slide.layerOrder || [SLIDE_TOKEN'));
  assert.ok(src.includes('const next = nextLayerOrder'));
  assert.ok(src.includes('prevOrder.every((id, i) => id === next[i])'));
});

test('SlideInspector: slide switch does not trigger auto-apply/thumbnail via stale inputs', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('pendingAutoApplyInputsRef'));
  assert.ok(src.includes('pendingThumbnailInputsRef'));
  assert.ok(src.includes('if (pendingAutoApplyInputsRef.current)'));
  assert.ok(src.includes('if (pendingThumbnailInputsRef.current)'));
});

test('SlideEditor: handleUpdateSlide forwards addToHistory to updateSlides', () => {
  const src = readUtf8('components/SlideEditor.tsx');
  assert.ok(src.includes('const handleUpdateSlide = (updatedSlide: Slide, addToHistory: boolean = true)'));
  assert.ok(src.includes('updateSlides(newSlides, addToHistory)'));
});
