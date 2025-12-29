import test from 'node:test';
import assert from 'node:assert/strict';

import { extractNarrationText } from '../utils/narrationScript.js';

test('extractNarrationText: null/undefined -> empty', () => {
  assert.equal(extractNarrationText(null), '');
  assert.equal(extractNarrationText(undefined), '');
});

test('extractNarrationText: JSON narration -> narration only', () => {
  const raw = JSON.stringify({ narration: '  続いて、今回のスライドを見ていきましょう。  ' });
  assert.equal(extractNarrationText(raw), '続いて、今回のスライドを見ていきましょう。');
});

test('extractNarrationText: JSON but missing narration -> returns cleaned text', () => {
  const raw = JSON.stringify({ text: 'A' });
  assert.equal(extractNarrationText(raw), raw);
});

test('extractNarrationText: handles marker line and drops preface', () => {
  const raw = [
    'はい、承知いたしました。直前のナレーションを踏まえ、自然な流れで今回のスライド内容を解説するプレゼンテーション用のナレーション原稿を作成します。',
    '---**ナレーション原稿:**',
    '続いて、このスライドではポイントを3つに分けて見ていきます。'
  ].join('\n');
  assert.equal(extractNarrationText(raw), '続いて、このスライドではポイントを3つに分けて見ていきます。');
});

test('extractNarrationText: marker with inline text keeps inline + rest', () => {
  const raw = [
    'ナレーション原稿: まず全体像をつかみましょう。',
    '次に、細かい部分を見ていきます。'
  ].join('\n');
  assert.equal(
    extractNarrationText(raw),
    'まず全体像をつかみましょう。\n次に、細かい部分を見ていきます。'
  );
});

test('extractNarrationText: strips json code fences then parses marker', () => {
  const raw = [
    '```json',
    'ナレーション原稿: テストです。',
    '```'
  ].join('\n');
  assert.equal(extractNarrationText(raw), 'テストです。');
});

test('extractNarrationText: non-string raw is stringified', () => {
  assert.equal(extractNarrationText(123), '123');
});

test('extractNarrationText: whitespace-only -> empty', () => {
  assert.equal(extractNarrationText('   \n\t  '), '');
});

test('extractNarrationText: JSON narration empty -> falls back', () => {
  const raw = JSON.stringify({ narration: '   ' });
  assert.equal(extractNarrationText(raw), raw);
});

test('extractNarrationText: marker line without colon works', () => {
  const raw = [
    '前置きです。',
    'ナレーション原稿',
    'ここから本文だけ。'
  ].join('\n');
  assert.equal(extractNarrationText(raw), 'ここから本文だけ。');
});

test('extractNarrationText: marker but no body -> returns as-is', () => {
  assert.equal(extractNarrationText('ナレーション原稿:'), 'ナレーション原稿:');
});
