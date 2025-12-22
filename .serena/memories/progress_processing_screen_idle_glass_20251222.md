## 2025-12-22
- 目的: PDF読み込み中の「解析中 / 作成中」画面（AppStatus.ANALYZING / CONVERTING）も、PDFアップロード(IDLE)と同じ“IDLE白ガラス”見た目に統一。

### 実装
- `App.tsx`
  - `isProcessing`（ANALYZING/CONVERTING）を追加。
  - ルートの `screen-idle` 適用を `isIdle || isProcessing` に拡張。
  - Non-Editor側の `idle-surface` 適用も `isIdle || isProcessing` に拡張。
- `components/ProcessingStep.tsx`
  - ダーク背景（`bg-slate-800/50` 等）を撤去し、`glass-strong` + `idle-sidebar-typography` + ヘアライン枠で白ガラス化。
  - 進捗バーのトラックを `bg-black/10`（白ガラス上で見える）に変更。
- `tests/idleGlassTheme.test.js`
  - `App.tsx` の条件式変更に合わせてアサーションを更新。

### 検証
- `npm test` PASS
