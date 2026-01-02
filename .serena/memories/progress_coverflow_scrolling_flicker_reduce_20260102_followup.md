## 2026-01-02 追加対応: 速いスワイプでもちらつきにくくする

### 背景
- 350msに延ばしても「速いスワイプ（早いスクロール）」でちらつきが残る。

### 対応
- `components/slideEditor/SlideGrid.tsx`
  - idle判定を `350ms → 500ms` に延長。
  - タイマー発火時に `scroller.scrollLeft` を確認し、値がまだ動いている場合は **解除せず延長**（scrollイベントが間引かれても、慣性スクロール中はOFF維持）。

### 狙い
- `data-coverflow-scrolling` が途中でOFF→ONと往復して `filter` が点滅するケースを減らす。

### 確認
- `npm test` PASS。
