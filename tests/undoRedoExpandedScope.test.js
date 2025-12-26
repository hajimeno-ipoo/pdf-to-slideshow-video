import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('undo/redo: history snapshot includes slideScale, borderRadius, bgm, narration', () => {
  const src = readUtf8('components/slideEditor/SlideEditorContext.tsx');
  assert.ok(src.includes('type UndoRedoSnapshot'));
  assert.ok(src.includes('slideScale'));
  assert.ok(src.includes('slideBorderRadius'));
  assert.ok(src.includes('backgroundFill'));
  assert.ok(src.includes('backgroundImageFile'));
  assert.ok(src.includes('bgmFile'));
  assert.ok(src.includes('bgmRange'));
  assert.ok(src.includes('bgmVolume'));
  assert.ok(src.includes('globalAudioFile'));
  assert.ok(src.includes('globalAudioVolume'));

  assert.ok(src.includes('useState<UndoRedoSnapshot[]>([])'));
  assert.ok(src.includes('const createSnapshot'));
  assert.ok(src.includes('const applySnapshot'));
  assert.ok(src.includes('setSlideScale(snapshot.slideScale)'));
  assert.ok(src.includes('setSlideBorderRadius(snapshot.slideBorderRadius)'));
  assert.ok(src.includes('setBackgroundFill(snapshot.backgroundFill)'));
  assert.ok(src.includes('setBackgroundImageFile(snapshot.backgroundImageFile)'));
  assert.ok(src.includes('setBgmFileState(snapshot.bgmFile)'));
  assert.ok(src.includes('setBgmRangeState(snapshot.bgmRange)'));
  assert.ok(src.includes('setBgmVolumeState(snapshot.bgmVolume)'));
  assert.ok(src.includes('setGlobalAudioFileState(snapshot.globalAudioFile)'));
  assert.ok(src.includes('setGlobalAudioVolumeState(snapshot.globalAudioVolume)'));
});

test('undo/redo: tracked settings push history', () => {
  const src = readUtf8('components/slideEditor/SlideEditorContext.tsx');
  assert.ok(src.includes('pushHistoryGrouped'));
  assert.ok(src.includes('willChangeSlideScale'));
  assert.ok(src.includes('willChangeSlideBorderRadius'));
  assert.ok(src.includes('willChangeBackgroundFill'));
  assert.ok(src.includes('willChangeBackgroundImageFile'));

  assert.ok(src.includes('const setBgmFile = useCallback'));
  assert.ok(src.includes('const setBgmRange = useCallback'));
  assert.ok(src.includes('const setBgmVolume = useCallback'));
  assert.ok(src.includes('const setGlobalAudioFile = useCallback'));
  assert.ok(src.includes('const setGlobalAudioVolume = useCallback'));
});
