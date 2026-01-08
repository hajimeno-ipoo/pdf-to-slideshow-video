import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('インスペクターの画像追加はオブジェクト(canvas)ではなくスライド要素として追加される', () => {
  const src = readFileSync(new URL('../components/SlideInspector.tsx', import.meta.url), 'utf8');

  const ifStart = src.indexOf("if (type === 'image' && imageData)");
  assert.ok(ifStart !== -1, '画像追加の if ブロックが見つからない');

  const imgSrcLine = src.indexOf('img.src = imageData;', ifStart);
  assert.ok(imgSrcLine !== -1, 'img.src = imageData; が見つからない');

  const block = src.slice(ifStart, imgSrcLine);

  // ここで "オブジェクト(canvas)扱い" にしてしまう設定が入っていないことを保証する
  assert.ok(!block.includes("space: isCanvasMode ? 'canvas' : undefined"));
  assert.ok(!block.includes("space: 'canvas'"));
});
