## 2025-12-26 Undo/Redo（↶↷）調査

### UIの場所
- 編集画面の上部ボタン列（「プロジェクト管理」の右）に ↶/↷ ボタンあり。
- `components/SlideEditor.tsx:242-247` で `onClick={undo}` / `onClick={redo}`、`disabled={!canUndo}` / `disabled={!canRedo}`。

### 実装（Undo/Redo）
- `components/slideEditor/SlideEditorContext.tsx:118-149`
  - `history: Slide[][]` と `future: Slide[][]` にスライド配列スナップショットを保持。
  - `updateSlides(newSlides, addToHistory=true)` が true のとき、現在の `slides` を `history` に push（最大50件）し、`future` をクリア。
  - `undo()` は `history` 末尾を復元し、現在の `slides` を `future` 先頭へ。
  - `redo()` は `future` 先頭を復元し、現在の `slides` を `history` へ。

### 対象範囲
- Undo/Redo が扱うのは `slides`（スライド配列）だけ。
- `videoSettings`（比率/解像度/format/背景塗り/スケール等）や音声系（BGM/ducking等）、UI状態（選択中IDなど）は Undo 対象外。

### ショートカット
- `components/SlideEditor.tsx:62-75`
  - Ctrl/Cmd+Z で undo、Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y で redo。
  - 全画面プレビュー中（`isPreviewOpen`）や input/textarea フォーカス中は無効。

### 自動保存との関係
- 自動保存は Undo/Redo とは別。
- `components/slideEditor/SlideEditorContext.tsx:185-198` で 2秒 debounce して `saveProjectState()`。
- `services/projectStorage.ts:57-71` の `saveProject(data)` は IndexedDB の固定キー（`autosave`）に `put` で上書き保存。
  - ＝自動保存は「最新1件の復元用」で、Undo履歴にはならない。

### 備考
- Undo履歴は React state 上のみ。ページリロードでリセットされる。