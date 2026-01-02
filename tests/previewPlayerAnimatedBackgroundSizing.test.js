import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('PreviewPlayer: 背景画像(アニメ系)は動画枠に合わせてcover表示する', () => {
  const src = readUtf8('components/PreviewPlayer.tsx');

  // 旧実装: stage全面 + contain でズレるので、残ってないこと
  assert.ok(!src.includes("videoSettings.aspectRatio === '9:16' ? 'cover' : 'contain'"));

  // 新実装: canvas と同じ基準で中央配置 + cover + scale
  assert.ok(src.includes('max-w-none max-h-none'));
  assert.ok(src.includes("objectFit: 'cover'"));
  assert.ok(src.includes('scale(${scale})'));
  assert.ok(src.includes("transformOrigin: 'center center'"));
});

