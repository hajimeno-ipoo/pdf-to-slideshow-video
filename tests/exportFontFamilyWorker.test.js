import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('videoWorkerScript: preloads Google Fonts for text overlays (export)', () => {
  const src = readUtf8('services/videoWorkerScript.ts');
  assert.ok(src.includes('loadGoogleFontsForFamilies'));
  assert.ok(src.includes('new FontFace'));
  assert.ok(src.includes('self.fonts.add'));
  assert.ok(src.includes('await fontsReadyPromise'));
});
