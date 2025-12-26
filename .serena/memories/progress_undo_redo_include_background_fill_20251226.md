## 2025-12-26
### 追加要望
- プロジェクト管理（設定）の「背景処理（黒/白/画像）」も Undo/Redo 対象にする。

### 対応
- `components/slideEditor/SlideEditorContext.tsx`
  - Undo用スナップショット `UndoRedoSnapshot` に以下を追加:
    - `backgroundFill`（黒/白/画像）
    - `backgroundImageFile`（画像選択時のファイル）
  - `createSnapshot()` / `applySnapshot()` で保存・復元。
  - `setVideoSettings()` で `backgroundFill/backgroundImageFile` が変わる時も `pushHistoryGrouped()` を呼ぶ。

### テスト
- `tests/undoRedoExpandedScope.test.js` を更新。
- `npm test` PASS / `npm run build` PASS。