import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('Import: bake frame thumbnails for SlideGrid on upload', () => {
  const src = readUtf8('App.tsx');
  assert.ok(src.includes('importFrameSettings'));
  assert.ok(src.includes('updateThumbnail(file, s, importFrameSettings)'));
  assert.ok(src.includes('updateThumbnail(null, s, importFrameSettings)'));
  assert.ok(src.includes('thumbnailIsFrame: true'));
});

