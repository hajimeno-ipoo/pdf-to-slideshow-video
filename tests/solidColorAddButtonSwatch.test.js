import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('solid color add: Toolbar reflects selected color on add button', () => {
  const src = readUtf8('components/slideEditor/Toolbar.tsx');
  assert.ok(src.includes('handleAddSolidColorSlide'));
  assert.ok(src.includes('無地'));

  const matches = src.match(/backgroundColor:\s*solidAddColor/g) || [];
  assert.ok(matches.length >= 2);
});
