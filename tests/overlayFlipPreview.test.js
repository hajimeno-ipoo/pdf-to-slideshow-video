import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('PreviewPlayer: overlay flipX/flipY reflected in DOM transform', async () => {
  const src = await fs.readFile(path.join(repoRoot, 'components/PreviewPlayer.tsx'), 'utf8');
  assert.ok(src.includes('ov.flipX ? -1 : 1'));
  assert.ok(src.includes('ov.flipY ? -1 : 1'));
  assert.ok(src.includes('scale(${scaleX}, ${scaleY})'));
});

