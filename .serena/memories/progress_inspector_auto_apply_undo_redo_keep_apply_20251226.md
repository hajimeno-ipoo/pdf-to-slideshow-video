## 2025-12-26
### 要望
- インスペクタ操作を Apple寄せ（編集と同時に反映）にしたい。
- ただし「適用」ボタンは残す。

### 対応
- `components/SlideEditor.tsx`
  - `handleUpdateSlide(updatedSlide, addToHistory=true)` に変更し、`updateSlides(newSlides, addToHistory)` を使えるようにした。
- `components/SlideInspector.tsx`
  - `onUpdate(updatedSlide, addToHistory?)` に変更。
  - インスペクタのローカル編集状態（crop/overlays/layout/layerOrder/無地色/audio 等）が変わるたびに、自動で `onUpdate` を呼んで即反映。
  - Undo/Redo が増えすぎないよう、約300msの編集セッションでまとめて「1回のUndo」にする（最初だけ `addToHistory=true`、続きは `false`）。
  - 自分の更新で prop 同期が走って選択解除されないよう `ignoreNextPropSyncRef` で同期をスキップ。
  - 「適用」ボタンはサムネ生成（updateThumbnail）用として残し、履歴を増やさないよう `onUpdate(updatedSlide, false)`。
- テスト
  - `tests/inspectorAutoApplyUndoRedo.test.js` を追加。

### 確認
- `npm test` PASS
- `npm run build` PASS（vite が node_modules/.vite-temp に書き込むため、環境によっては権限が必要）