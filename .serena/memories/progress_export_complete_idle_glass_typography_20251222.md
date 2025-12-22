## 2025-12-22
- 目的: 書き出し完了画面（AppStatus.COMPLETED）も、PDFアップロード/スライド編集と同じIDLE白ガラス＋文字階級（primary/secondary/muted）に統一。

### 実装
- `App.tsx`
  - `isCompleted` を追加し、`screen-idle` / `idle-surface` / `Header idleTheme` の適用条件に `COMPLETED` を含めた。
  - 完了画面のルートに `idle-sidebar-typography` を付与。
  - 動画プレビュー枠を `glass-strong`（ヘアライン枠 `border-black/10`）へ変更。
  - ヒントチップを `glass-thin`（ヘアライン枠）へ変更。
  - ボタンはIDLE基準に合わせて `idle-btn-primary`（動画DL）+ `idle-btn-glass`（画像DL/再編集/最初から）へ統一。
- `tests/idleGlassTheme.test.js`
  - `App.tsx` の条件式変更に合わせてアサーションを更新。

### 検証
- `npm test` PASS
