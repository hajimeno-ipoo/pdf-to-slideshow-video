## 2025-12-20
- `public/usage.html` / `public/terms.html` / `public/privacy.html`
  - 「アプリに戻る」を `history.back()` 優先に変更（直前の画面に戻れるように）。
  - 表示をMarkdownそのまま（`<pre>`）から、見出し/段落/リストのHTML表示へ変更。
  - リンク色を見やすく調整（CSSの `--link` を明るい色に）。
- `components/Header.tsx` のヘッダーリンク色を見やすく調整。
- JSON読み込み上限を 50MB → 100MB に変更（`utils/projectFileImport.js` のデフォルト `maxBytes`）。
- `USER_MANUAL.md` の記載も 100MB に更新。
- テスト追加: `tests/publicDocs.test.js`（docsがMarkdown表示じゃないこと等）、`tests/projectFileImport.test.js`（100MBデフォルト等）。
- `npm test` / `npm run test:coverage` / `npm run build` で動作確認済み。