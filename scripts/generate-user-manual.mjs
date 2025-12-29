import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const MANUAL_MD_PATH = path.join(projectRoot, 'USER_MANUAL.md');
const DOC_IMAGES_DIR = path.join(projectRoot, 'Doc', 'manual_images');

const PUBLIC_DIR = path.join(projectRoot, 'public');
const PUBLIC_MANUAL_HTML_PATH = path.join(PUBLIC_DIR, 'user_manual.html');
const PUBLIC_IMAGES_DIR = path.join(PUBLIC_DIR, 'manual_images');

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatInline(text) {
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, (_m, bold) => `<strong>${bold}</strong>`);
  return escaped;
}

function rewriteImagePath(src) {
  const normalized = src.replaceAll('\\', '/');
  if (normalized.startsWith('Doc/manual_images/')) return `manual_images/${normalized.split('/').pop()}`;
  return normalized;
}

function parseMarkdownToHtml(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');

  let i = 0;
  let title = 'USER MANUAL';
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      i += 1;
      break;
    }
    i += 1;
  }

  while (i < lines.length && lines[i].trim() === '') i += 1;

  const out = [];
  let paragraphLines = [];
  let inCodeBlock = false;
  let codeBlockLines = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines.map(s => s.trim()).filter(Boolean).join(' ');
    out.push(`<p>${formatInline(joined)}</p>`);
    paragraphLines = [];
  };

  const flushCodeBlock = () => {
    if (!inCodeBlock) return;
    const code = escapeHtml(codeBlockLines.join('\n'));
    out.push(`<pre><code>${code}</code></pre>`);
    inCodeBlock = false;
    codeBlockLines = [];
  };

  const headingLevel = (line) => {
    if (line.startsWith('#### ')) return 4;
    if (line.startsWith('### ')) return 3;
    if (line.startsWith('## ')) return 2;
    return 0;
  };

  const isHr = (line) => line.trim() === '---';

  const matchImage = (line) => {
    const m = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (!m) return null;
    return { alt: m[1], src: m[2] };
  };

  const matchListItem = (line) => {
    const unordered = line.match(/^(\s*)-\s+(.+)$/);
    if (unordered) return { indent: unordered[1].length, type: 'ul', text: unordered[2] };
    const ordered = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (ordered) return { indent: ordered[1].length, type: 'ol', text: ordered[2] };
    return null;
  };

  const parseList = (startIndex, baseIndent) => {
    const first = matchListItem(lines[startIndex]);
    if (!first) return { html: '', nextIndex: startIndex };

    const listType = first.type;
    let idx = startIndex;
    const items = [];

    while (idx < lines.length) {
      const line = lines[idx];
      if (line.trim() === '') {
        idx += 1;
        continue;
      }

      const item = matchListItem(line);
      if (!item) break;
      if (item.indent < baseIndent) break;
      if (item.indent > baseIndent) break;
      if (item.type !== listType) break;

      let itemText = item.text;
      idx += 1;

      const nestedBlocks = [];
      while (idx < lines.length) {
        const nextLine = lines[idx];
        if (nextLine.trim() === '') {
          idx += 1;
          continue;
        }

        const nextItem = matchListItem(nextLine);
        if (nextItem && nextItem.indent === baseIndent && nextItem.type === listType) break;
        if (nextItem && nextItem.indent > baseIndent) {
          const nested = parseList(idx, nextItem.indent);
          nestedBlocks.push(nested.html);
          idx = nested.nextIndex;
          continue;
        }

        const nextIndent = nextLine.match(/^(\s*)/)?.[1]?.length ?? 0;
        if (nextIndent <= baseIndent) break;

        itemText += ` ${nextLine.trim()}`;
        idx += 1;
      }

      const nestedHtml = nestedBlocks.length > 0 ? `\n${nestedBlocks.join('\n')}\n` : '';
      items.push(`<li>${formatInline(itemText)}${nestedHtml}</li>`);
    }

    const tag = listType === 'ol' ? 'ol' : 'ul';
    const html = [`<${tag}>`, ...items, `</${tag}>`].join('\n');
    return { html, nextIndex: idx };
  };

  for (; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    if (inCodeBlock) {
      if (line.trim().startsWith('```')) {
        flushCodeBlock();
        continue;
      }
      codeBlockLines.push(rawLine);
      continue;
    }

    if (line.trim().startsWith('```')) {
      flushParagraph();
      inCodeBlock = true;
      codeBlockLines = [];
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    if (isHr(line)) {
      flushParagraph();
      out.push('<hr />');
      continue;
    }

    const lvl = headingLevel(line);
    if (lvl > 0) {
      flushParagraph();
      const text = line.slice(lvl + 1).trim();
      out.push(`<h${lvl}>${formatInline(text)}</h${lvl}>`);
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      const text = line.slice(2).trim();
      out.push(`<h2>${formatInline(text)}</h2>`);
      continue;
    }

    const image = matchImage(line);
    if (image) {
      flushParagraph();
      const src = rewriteImagePath(image.src);
      out.push(`<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(image.alt)}" /></figure>`);
      continue;
    }

    const listItem = matchListItem(rawLine);
    if (listItem) {
      flushParagraph();
      const parsed = parseList(i, listItem.indent);
      out.push(parsed.html);
      i = parsed.nextIndex - 1;
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  flushCodeBlock();

  return { title, bodyHtml: out.join('\n') };
}

function buildHtml({ title, bodyHtml }) {
  const docTitle = `${title} | PDF Slideshow Maker`;

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(docTitle)}</title>
    <script>
      (function () {
        try {
          var params = new URLSearchParams(location.search);
          if (params.get('theme') === 'idle') document.documentElement.classList.add('theme-idle');
        } catch (e) {}
      })();
    </script>
    <style>
      :root {
        --bg-950: #0b1220;
        --bg-900: #0e1a2b;
        --border-800: #1f2937;
        --text-main: #e5e7eb;
        --text-sub: #9ca3af;
        --link: #34d399;
        --code-bg: rgba(148, 163, 184, 0.12);
      }
      html.theme-idle {
        --bg-950: rgba(255, 255, 255, 0.14);
        --bg-900: transparent;
        --border-800: rgba(15, 23, 42, 0.12);
        --text-main: rgba(15, 23, 42, 0.92);
        --text-sub: rgba(15, 23, 42, 0.56);
        --link: #007aff;
        --code-bg: rgba(15, 23, 42, 0.08);
      }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans JP', sans-serif;
        background-color: var(--bg-900);
        color: var(--text-main);
      }
      html.theme-idle body {
        background:
          radial-gradient(900px 500px at 12% 18%, rgba(0, 122, 255, 0.22), transparent 60%),
          radial-gradient(900px 500px at 88% 80%, rgba(88, 86, 214, 0.18), transparent 60%),
          linear-gradient(180deg, #ffffff, #f1f5f9);
        background-attachment: fixed;
      }
      a { color: var(--link); text-decoration: underline; text-underline-offset: 2px; }
      a:hover { text-decoration-thickness: 2px; }
      header {
        background: var(--bg-950);
        border-bottom: 1px solid var(--border-800);
      }
      html.theme-idle header {
        -webkit-backdrop-filter: blur(22px) saturate(160%);
        backdrop-filter: blur(22px) saturate(160%);
      }
      .container {
        max-width: 960px;
        margin: 0 auto;
        padding: 12px 16px;
      }
      h1 {
        font-size: 20px;
        margin: 16px 0 12px;
      }
      h2 {
        font-size: 16px;
        margin: 18px 0 8px;
      }
      h3 {
        font-size: 14px;
        margin: 16px 0 8px;
      }
      h4 {
        font-size: 13px;
        margin: 14px 0 8px;
        color: var(--text-sub);
      }
      p, li {
        font-size: 14px;
        line-height: 1.7;
      }
      p {
        margin: 8px 0;
      }
      ul, ol {
        margin: 8px 0;
        padding-left: 1.2em;
      }
      li {
        margin: 6px 0;
      }
      section {
        margin: 14px 0;
      }
      hr {
        border: 0;
        border-top: 1px solid var(--border-800);
        margin: 18px 0;
        opacity: 0.6;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        font-size: 12px;
        padding: 2px 6px;
        border-radius: 8px;
        background: var(--code-bg);
        border: 1px solid var(--border-800);
      }
      pre {
        margin: 12px 0;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.18);
        border: 1px solid var(--border-800);
        overflow: auto;
      }
      html.theme-idle pre {
        background: rgba(15, 23, 42, 0.06);
      }
      pre code {
        display: block;
        padding: 0;
        border: 0;
        background: transparent;
        font-size: 12px;
      }
      figure {
        margin: 14px 0;
      }
      figure img {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 16px;
        border: 1px solid var(--border-800);
      }
      .card {
        margin: 12px 0 0;
        padding: 16px;
        background: rgba(0, 0, 0, 0.18);
        border: 1px solid var(--border-800);
        border-radius: 12px;
      }
      html.theme-idle .card {
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.18);
        -webkit-backdrop-filter: blur(16px) saturate(160%);
        backdrop-filter: blur(16px) saturate(160%);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
      }
      html.theme-idle .card::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 55%);
        box-shadow: inset 0 0 15px -5px rgba(255, 255, 255, 1);
      }
      html.theme-idle .card > * { position: relative; }
      .meta {
        color: var(--text-sub);
        font-size: 12px;
      }
    </style>
    <script>
      function goBackToApp() {
        if (window.opener && !window.opener.closed) {
          try { window.opener.focus(); } catch (e) {}
          try { window.close(); } catch (e) {}
          return false;
        }
        if (history.length > 1) {
          history.back();
          return false;
        }
        location.href = './index.html';
        return false;
      }
    </script>
  </head>
  <body>
    <header>
      <div class="container">
        <a href="./index.html" onclick="return goBackToApp();">← アプリに戻る</a>
      </div>
    </header>
    <main class="container">
      <h1>${escapeHtml(title)}</h1>
      <article class="card">
${bodyHtml.replaceAll('\n', '\n        ')}
      </article>
    </main>
  </body>
</html>
`;
}

async function syncImages() {
  try {
    const entries = await fs.readdir(DOC_IMAGES_DIR, { withFileTypes: true });
    await fs.mkdir(PUBLIC_IMAGES_DIR, { recursive: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (!lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.jpeg') && !lower.endsWith('.webp')) continue;

      const from = path.join(DOC_IMAGES_DIR, entry.name);
      const to = path.join(PUBLIC_IMAGES_DIR, entry.name);
      await fs.copyFile(from, to);
    }
  } catch (e) {
    if (e && e.code === 'ENOENT') return;
    throw e;
  }
}

async function main() {
  const md = await fs.readFile(MANUAL_MD_PATH, 'utf8');
  const { title, bodyHtml } = parseMarkdownToHtml(md);
  const html = buildHtml({ title, bodyHtml });

  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.writeFile(PUBLIC_MANUAL_HTML_PATH, html, 'utf8');
  await syncImages();
}

await main();
