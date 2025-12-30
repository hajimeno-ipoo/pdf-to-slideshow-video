import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('AudioSettingsPanel: initialScript change updates ttsText', () => {
  const src = readUtf8('components/cropModal/AudioSettingsPanel.tsx');

  assert.match(src, /setTtsText\(initialScript\s*\|\|\s*(['"])\1\)/);
  assert.ok(!src.includes('if (initialScript && !ttsText)'));
});
