import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('スライド要素を少しでもスライド外へ出したらオブジェクト(canvas)へ昇格する判定がある', () => {
  const src = readFileSync(new URL('../components/SlideInspector.tsx', import.meta.url), 'utf8');

  const start = src.indexOf('const handleMouseUp = () => {');
  assert.ok(start !== -1, 'handleMouseUp が見つからない');

  const end = src.indexOf('setIsDraggingOverlay(false)', start);
  assert.ok(end !== -1, 'handleMouseUp の末尾付近が見つからない');

  const block = src.slice(start, end);

  // stale state防止：最新の overlays(prev) を使って判定する
  assert.ok(block.includes('setOverlays(prev => {'));
  assert.ok(block.includes('const target = prev.find'));

  // 中心点だけじゃなく、幅/高さ(四角)で外判定していることを保証する
  assert.ok(block.includes('const halfW = (target.width ?? 0) / 2;'));
  assert.ok(block.includes('const halfH = (target.height ?? 0) / 2;'));
  assert.ok(block.includes('const minX = target.x - halfW;'));
  assert.ok(block.includes('const maxX = target.x + halfW;'));
  assert.ok(block.includes('const minY = target.y - halfH;'));
  assert.ok(block.includes('const maxY = target.y + halfH;'));
  assert.ok(block.includes('const isOutside = (minX < 0 || maxX > 1 || minY < 0 || maxY > 1);'));
});
