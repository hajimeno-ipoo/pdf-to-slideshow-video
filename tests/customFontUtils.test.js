import test from 'node:test';
import assert from 'node:assert/strict';

import { buildUniqueFontFamily, getFontFileExtension, isSupportedFontFile, normalizeFontDisplayName } from '../utils/customFontUtils.js';

test('getFontFileExtension: basic', () => {
  assert.equal(getFontFileExtension('font.woff2'), 'woff2');
  assert.equal(getFontFileExtension('/a/b/c/font.TTF'), 'ttf');
});

test('getFontFileExtension: invalid', () => {
  assert.equal(getFontFileExtension(null), '');
  assert.equal(getFontFileExtension(''), '');
  assert.equal(getFontFileExtension('noext'), '');
  assert.equal(getFontFileExtension('.hiddenfile'), '');
});

test('isSupportedFontFile: supports common ext', () => {
  assert.equal(isSupportedFontFile({ name: 'a.woff2' }), true);
  assert.equal(isSupportedFontFile({ name: 'a.woff' }), true);
  assert.equal(isSupportedFontFile({ name: 'a.ttf' }), true);
  assert.equal(isSupportedFontFile({ name: 'a.otf' }), true);
});

test('isSupportedFontFile: rejects unknown', () => {
  assert.equal(isSupportedFontFile({ name: 'a.png' }), false);
  assert.equal(isSupportedFontFile({ name: '' }), false);
});

test('normalizeFontDisplayName: strips ext and prettifies', () => {
  assert.equal(normalizeFontDisplayName('My_Font-Regular.woff2'), 'My Font Regular');
  assert.equal(normalizeFontDisplayName('/a/b/c/Kaisei-Decol.ttf'), 'Kaisei Decol');
});

test('normalizeFontDisplayName: empty -> Custom Font', () => {
  assert.equal(normalizeFontDisplayName(''), 'Custom Font');
  assert.equal(normalizeFontDisplayName(null), 'Custom Font');
  assert.equal(normalizeFontDisplayName('.woff2'), 'Custom Font');
});

test('buildUniqueFontFamily: keeps when unused', () => {
  assert.equal(buildUniqueFontFamily(new Set(['A']), 'B'), 'B');
  assert.equal(buildUniqueFontFamily(['A'], 'B'), 'B');
});

test('buildUniqueFontFamily: adds suffix when used', () => {
  const existing = new Set(['My Font', 'My Font 2']);
  assert.equal(buildUniqueFontFamily(existing, 'My Font'), 'My Font 3');
});

test('buildUniqueFontFamily: fallback', () => {
  const existing = new Set();
  for (let i = 0; i <= 999; i++) existing.add(`A ${i}`);
  existing.add('A');
  const name = buildUniqueFontFamily(existing, 'A');
  assert.ok(name.startsWith('A '));
});

