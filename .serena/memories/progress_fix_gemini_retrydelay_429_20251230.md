## 2025-12-30
- 課題: PDFアップロード画面の「AIで原稿生成」で、ナレーション原稿が空になる（Consoleに `ApiError 429 RESOURCE_EXHAUSTED` / `Please retry in XXs` が出る）。

### 原因
- `services/geminiService.ts` の `callWithRetry()` が 2s→4s→8s の短い待機しかせず、Gemini が返してくる `RetryInfo.retryDelay`（例: 54s）を待つ前にリトライを打ち切ってしまうため。

### 対応
- `utils/geminiRetryDelay.js`
  - `getGeminiRetryDelayMs(error, fallbackMessage)` を追加。
  - `error.error.details` / `error.details` の `google.rpc.RetryInfo.retryDelay`（例: `"54s"`）を優先してmsへ変換。
  - フォールバックでメッセージ内の `retryDelay":"Xs"` / `Please retry in Xs` も解析。
- `services/geminiService.ts`
  - 429（レート/クォータ）時は `getGeminiRetryDelayMs()` の推奨待機時間を尊重して待つ（最大5分で上限）。
  - `notifyCooldown` の表示も待機時間に合わせる。

### テスト
- `npm test` OK
- `npm run test:coverage` OK（`utils/geminiRetryDelay.js` は line/branch/funcs 100%）

### メモ
- 1日上限など「クォータそのもの」はアプリ側で増やせないため、上限に達した場合は待機/課金/プラン確認が必要。