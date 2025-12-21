import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const readUtf8 = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('videoWorkerScript: uses f32-planar and fixed AAC decoderConfig (Safari-safe)', () => {
  const src = readUtf8('services/videoWorkerScript.ts');
  assert.ok(src.includes("format: 'f32-planar'"));
  assert.ok(src.includes("codec: 'mp4a.40.2'"));
  assert.ok(src.includes('sampleRate: 44100'));
  assert.ok(src.includes('numberOfChannels: 2'));
  assert.ok(src.includes('{ decoderConfig: aacDecoderConfig }'));
  assert.ok(!src.includes('meta?.decoderConfig'));
});

test('PreviewPlayer: seek scrub uses pointer handlers and playback ref', () => {
  const src = readUtf8('components/PreviewPlayer.tsx');
  assert.ok(src.includes('onPointerDown={beginSeekScrub}'));
  assert.ok(src.includes('onPointerUp={endSeekScrub}'));
  assert.match(src, /if\s*\(\s*isPlayingRef\.current\s*\)/);
});

