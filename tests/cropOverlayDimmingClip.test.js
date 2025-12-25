import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('crop overlay: dimming is clipped (not full-screen dark)', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  assert.ok(src.includes('bg-black/50" style={{ clipPath:'));
});

