import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('overlay image: preview keeps aspect (contain)', () => {
  const src = readUtf8('components/PreviewPlayer.tsx');
  const anchor = "ov.type === 'image' && ov.imageData";
  const idx = src.indexOf(anchor);
  assert.ok(idx !== -1);
  const snippet = src.slice(idx, idx + 2500);
  assert.ok(snippet.includes("objectFit: 'contain'"));
});

test('overlay image: inspector keeps aspect (contain)', () => {
  const src = readUtf8('components/SlideInspector.tsx');
  const anchor = "ov.type === 'image' && ov.imageData";
  const idx = src.indexOf(anchor);
  assert.ok(idx !== -1);
  const snippet = src.slice(idx, idx + 2500);
  assert.ok(snippet.includes("objectFit: 'contain'"));
});

test('overlay image: export keeps aspect (contain)', () => {
  const src = readUtf8('services/pdfVideoService.ts');
  assert.ok(src.includes("const scale = Math.min(targetW / img.width, targetH / img.height);"));
  assert.ok(src.includes('ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);'));
});

test('overlay image: worker export keeps aspect (contain)', () => {
  const src = readUtf8('services/videoWorkerScript.ts');
  assert.ok(src.includes('const scale = Math.min(targetW / srcW, targetH / srcH);'));
  assert.ok(src.includes('ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);'));
});
