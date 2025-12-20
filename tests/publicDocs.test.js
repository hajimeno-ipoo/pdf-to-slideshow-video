import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DOC_FILES = ['usage.html', 'terms.html', 'privacy.html'];

for (const filename of PUBLIC_DOC_FILES) {
  test(`public docs: ${filename} is HTML (not markdown)`, async () => {
    const filePath = path.join(process.cwd(), 'public', filename);
    const html = await fs.readFile(filePath, 'utf-8');

    assert.equal(html.includes('<pre>'), false);
    assert.equal(/\n#\s/.test(html), false);
    assert.equal(/\n##\s/.test(html), false);
    assert.equal(html.includes('history.back()'), true);
    assert.equal(html.includes('window.opener'), true);
    assert.equal(html.includes('--link: #34d399'), true);
    assert.equal(html.includes('<section>'), true);
    assert.equal(html.includes('Doc/'), false);
  });
}
