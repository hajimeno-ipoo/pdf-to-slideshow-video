import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('completed video: native controls auto-hide (Safari暗幕対策)', () => {
  const src = readUtf8('App.tsx');

  assert.ok(src.includes('COMPLETED_VIDEO_CONTROLS_HIDE_DELAY_MS'));
  assert.ok(src.includes('controls={completedVideoControls}'));
  assert.ok(src.includes('onPointerMove={handleCompletedVideoInteract}'));
  assert.ok(src.includes('onPointerLeave={hideCompletedVideoControlsNow}'));
  assert.ok(src.includes('setCompletedVideoControls(false)'));
});
