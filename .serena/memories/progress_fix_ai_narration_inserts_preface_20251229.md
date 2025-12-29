## 2025-12-29
- 課題: PDFアップロード画面で「AIで原稿生成」したとき、前置き（例:「はい、承知いたしました…」「---**ナレーション原稿:**」）まで読み上げテキストに混ざる。

### 対応
- `services/geminiService.ts`
  - `generateSlideScript` を JSON 構造化出力に変更。
  - `config.responseMimeType="application/json"` + `responseSchema`（narrationのみ）で、本文だけ返すよう強制。
  - 返却は `extractNarrationText()` で本文だけ抽出して返す。
- `utils/narrationScript.js`
  - `extractNarrationText(raw)` を追加（JSON優先、フォールバックで「ナレーション原稿:」等のマーカーから本文抽出）。
- `tests/narrationScript.test.js`
  - 追加ユーティリティの単体テスト追加。

### テスト
- `npm test` OK
- `npm run test:coverage` OK（`utils/narrationScript.js` は line/branch/funcs 100%）

### メモ
- 既存機能（150文字以内・文脈維持・カスタム指示）は維持しつつ、出力に前置き/見出しが混ざらないようにした。