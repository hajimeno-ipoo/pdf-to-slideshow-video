## 2025-12-25

### 目的
- スライド追加の「前/後」セグメントで、どちらが選択中か分かりにくい問題を改善。
- ガラススタイルは維持しつつ、選択中だけ“白(＋うす青)の板”を敷く。

### 変更点
- `components/slideEditor/Toolbar.tsx`
  - 「前/後」ボタンのラッパーに `idle-segment` を追加。
  - ボタンに `idle-segment-btn` と、選択中だけ `is-selected` を付与。

- `index.css`
  - `.screen-idle .editor-glass .idle-segment .idle-segment-btn` を追加して、IDLE/編集のガラス上でも
    - 未選択: 透明
    - 選択中: 白い板 + うす青の縁(内側) + ぼかし
    になるように `!important` で上書き。

### テスト
- 追加: `tests/idleSegmentSelectedPlate.test.js`
- 実行: `npm test` 成功