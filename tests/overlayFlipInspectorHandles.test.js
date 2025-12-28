import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('SlideInspector: flip applies to content only (handles not flipped)', async () => {
  const src = await fs.readFile(path.join(repoRoot, 'components/SlideInspector.tsx'), 'utf8');

  // Outer wrapper should NOT include flip scale (this would mirror handles/resize direction).
  assert.ok(!src.includes('rotate(${ov.rotation || 0}deg) scale(${ov.flipX ? -1 : 1}, ${ov.flipY ? -1 : 1})'));

  // Flip scale should still exist, but applied to an inner content wrapper.
  assert.ok(src.includes('transform: `scale(${ov.flipX ? -1 : 1}, ${ov.flipY ? -1 : 1})`'));
});

