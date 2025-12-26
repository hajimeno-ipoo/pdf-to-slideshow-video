## 2025-12-26
### 目的
- Undo/Redo（↶↷）の対象を `slides` だけでなく、以下にも拡張:
  - `videoSettings.slideScale`（スライド縮小）
  - `videoSettings.slideBorderRadius`（角丸半径）
  - BGM（追加/範囲/音量）
  - 全体ナレーション（追加/音量）

### 実装
- `components/slideEditor/SlideEditorContext.tsx`
  - 履歴を `Slide[][]` → `UndoRedoSnapshot[]` に変更。
  - Snapshot内容:
    - `slides`
    - `slideScale`, `slideBorderRadius`
    - `bgmFile`, `bgmRange`, `bgmVolume`
    - `globalAudioFile`, `globalAudioVolume`
  - `setVideoSettings` は `slideScale/slideBorderRadius` が変わる時だけ履歴に積む。
  - `setBgmFile/setBgmRange/setBgmVolume/setGlobalAudioFile/setGlobalAudioVolume` は変更時に履歴に積む。
  - 連続操作（range/volumeのドラッグ等）で履歴が増えすぎないよう、`pushHistoryGrouped()` で約300ms単位にまとめる。
  - `undo/redo` は snapshot を `applySnapshot()` で復元し、同時に現在状態を future/history に退避。

### テスト
- `tests/undoRedoExpandedScope.test.js` を追加（ファイル内容の存在確認ベース）。
- `npm test` PASS / `npm run build` PASS。