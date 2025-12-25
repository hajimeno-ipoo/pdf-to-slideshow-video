## 2025-12-25

### 症状
- インスペクタのトリミング画面でプレビューが常に暗い。

### 原因
- Crop Overlay の暗幕（`bg-black/50`）が外側コンテナに付いていて、
  `clipPath` は背景の無い内側divに当たっていたため、暗幕が全体に乗りっぱなしになっていた。

### 修正
- `components/SlideInspector.tsx`
  - `bg-black/50` を `clipPath` を持つ要素側へ移動し、暗くなる範囲を clip で外側だけに限定。

### テスト
- 追加: `tests/cropOverlayDimmingClip.test.js`
- 実行: `npm test` 成功