import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('export screen buttons: labels updated and no-wrap styles applied', () => {
  const src = readUtf8('App.tsx');

  assert.ok(src.includes('動画ダウンロード'));
  assert.ok(src.includes('画像ダウンロード'));
  assert.ok(src.includes('再編集'));

  assert.ok(!src.includes('動画をダウンロード'));
  assert.ok(!src.includes('再編集する'));

  assert.ok(src.includes('sm:flex-nowrap'));
  assert.ok(src.includes('whitespace-nowrap'));
});
