import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('toast: bottom-right placement and close button exist', () => {
  const src = readUtf8('components/ToastProvider.tsx');

  assert.ok(src.includes('fixed bottom-4 right-4'));
  assert.ok(src.includes('aria-label="閉じる"'));
  assert.ok(src.includes('success: 2000'));
  assert.ok(src.includes('error: 5000'));

  const index = readUtf8('index.tsx');
  assert.ok(index.includes('<ToastProvider>'));
});

