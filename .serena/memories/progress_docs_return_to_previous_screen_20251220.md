## 2025-12-20
- docsリンク（利用について/利用規約/プライバシーポリシー）を、ページ遷移ではなく `window.open(..., 'pdf-video-docs')` で別タブ(同一)に開くよう変更。これでアプリ側の状態（起動/編集/書き出し）を維持したまま見れる。
- docs側の「← アプリに戻る」は、`window.opener` があれば opener を focus して閉じる（なければ `history.back()` / `index.html` フォールバック）。
- docs画面に出してたファイル名表示（例: `Doc/USAGE_ONEPAGE.md`）を削除。
- テスト更新: `tests/publicDocs.test.js` で `window.opener`/`Doc/` 非表示を検証。