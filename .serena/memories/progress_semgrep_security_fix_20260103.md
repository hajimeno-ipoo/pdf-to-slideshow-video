## 2026-01-03
- Semgrep指摘への最小修正を実施。
  - console.* のテンプレート文字列を固定メッセージ+引数に変更。
  - index.html の外部scriptに integrity + crossorigin を追加。
  - scripts/generate-user-manual.mjs の escapeHtml を replaceAll 連鎖から正規表現置換に変更。
- Semgrep MCPで再スキャンし、指摘は0件（Pro専用ルールの内部エラー警告のみ）。