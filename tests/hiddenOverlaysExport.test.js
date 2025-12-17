import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('export pipeline skips hidden overlays (pdfVideoService)', async () => {
  const src = await fs.readFile(path.join(repoRoot, 'services/pdfVideoService.ts'), 'utf8');
  assert.ok(src.includes('for (const overlay of overlays) {'));
  assert.ok(src.includes('if (overlay.hidden) continue;'));
});

test('export pipeline skips hidden overlays (videoWorkerScript)', async () => {
  const src = await fs.readFile(path.join(repoRoot, 'services/videoWorkerScript.ts'), 'utf8');
  assert.ok(src.includes('for (const overlay of overlays) {'));
  assert.ok(src.includes('if (overlay.hidden) continue;'));
  assert.ok(src.includes('for (const ov of slide.overlays) {'));
  assert.ok(src.includes('if (ov.hidden) continue;'));
});
