import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const assertStartAndEndTimeSlidersAreIndependent = (src, fileLabel) => {
  assert.equal(src.includes('表示期間 (Duration)'), false, `${fileLabel}: should not use Duration slider anymore`);

  assert.ok(src.includes('開始時間 (Start Time)'), `${fileLabel}: missing Start Time label marker`);
  assert.ok(src.includes('終了時間 (End Time)'), `${fileLabel}: missing End Time label marker`);

  assert.ok(
    /onChange=\{\(e\)\s*=>\s*onUpdateOverlay\(\{\s*startTime:\s*parseFloat\(e\.target\.value\)\s*\}\)\s*\}/.test(src),
    `${fileLabel}: Start Time slider must update only startTime`
  );

  assert.ok(src.includes('min="0"'), `${fileLabel}: should use fixed min="0" for time sliders`);
  assert.ok(src.includes('max={slideDuration}'), `${fileLabel}: should use slideDuration as max for time sliders`);
  assert.ok(
    /onChange=\{\(e\)\s*=>\s*onUpdateOverlay\(\{\s*endTime:\s*parseFloat\(e\.target\.value\)\s*\}\)\s*\}/.test(src),
    `${fileLabel}: End Time slider must update only endTime`
  );
};

test('overlay/image animation: Start/End sliders are independent', () => {
  assertStartAndEndTimeSlidersAreIndependent(readUtf8('components/cropModal/OverlaySettingsPanel.tsx'), 'OverlaySettingsPanel.tsx');
  assertStartAndEndTimeSlidersAreIndependent(readUtf8('components/cropModal/ImageSettingsPanel.tsx'), 'ImageSettingsPanel.tsx');
});

test('types: Overlay supports endTime', () => {
  const src = readUtf8('types.ts');
  assert.ok(src.includes('endTime?: number'));
});
