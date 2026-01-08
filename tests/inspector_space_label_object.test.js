import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('要素一覧の space ラベルは canvas を「オブジェクト」と表示する', () => {
  const src = readFileSync(new URL('../components/SlideInspector.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes("? 'オブジェクト' : 'スライド'"));
});

