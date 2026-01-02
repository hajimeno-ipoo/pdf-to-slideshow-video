## 2026-01-02 対応: coverflowスワイプ中だけ glass-distortion を停止

### 背景
- スライド編集のカバーフロー操作で「画面全体が一瞬フラッシュ」
- 切り分けで `glass-distortion` をOFFにすると改善する傾向があったため、スワイプ中だけOFFにする方針に確定

### 実装
- `components/slideEditor/SlideGrid.tsx`
  - coverflowの scroller `scroll` イベント中だけ、親の `.screen-idle` に `data-coverflow-scrolling="true"` を付与
  - 最終スクロールから 140ms 後に属性を解除
  - cleanupでも確実に解除

- `index.css`
  - `.screen-idle[data-coverflow-scrolling="true"] .editor-glass::after` の間だけ
    - `filter:url(#glass-distortion)` を `none` にして歪みを停止

- `tests/slideGridCoverflow.test.js`
  - data属性とCSSルールの存在を確認

### 動作確認
- Playwrightで「スクロール中だけ filter が none になり、止まると url(#glass-distortion) に戻る」ことを確認
- `npm test` PASS
