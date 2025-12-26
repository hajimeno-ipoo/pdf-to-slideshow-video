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

test('SlideEditor: handleUpdateSlide forwards addToHistory to updateSlides', () => {
  const src = readUtf8('components/SlideEditor.tsx');
  assert.ok(src.includes('const handleUpdateSlide = (updatedSlide: Slide, addToHistory: boolean = true)'));
  assert.ok(src.includes('updateSlides(newSlides, addToHistory)'));
});
