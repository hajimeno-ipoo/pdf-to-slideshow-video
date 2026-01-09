import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const walk = (dir) => {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git' || ent.name === '.serena') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

const shouldScan = (filePath) => (
  filePath.endsWith('.ts') ||
  filePath.endsWith('.tsx') ||
  filePath.endsWith('.js') ||
  filePath.endsWith('.jsx')
);

test('no alert() remains in app source', () => {
  const targets = [
    path.join(projectRoot, 'App.tsx'),
    path.join(projectRoot, 'index.tsx'),
    path.join(projectRoot, 'components'),
    path.join(projectRoot, 'services'),
    path.join(projectRoot, 'utils'),
  ];

  const files = [];
  for (const t of targets) {
    if (!fs.existsSync(t)) continue;
    const stat = fs.statSync(t);
    if (stat.isDirectory()) files.push(...walk(t));
    else files.push(t);
  }

  for (const filePath of files) {
    if (!shouldScan(filePath)) continue;
    const rel = path.relative(projectRoot, filePath);
    const src = fs.readFileSync(filePath, 'utf8');
    assert.ok(!src.includes('alert('), `Found alert() usage in ${rel}`);
  }
});

