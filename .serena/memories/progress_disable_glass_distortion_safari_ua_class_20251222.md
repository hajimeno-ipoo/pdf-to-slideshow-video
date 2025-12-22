## 2025-12-22
- 目的: Safariだけで起きるガラスのちらつき対策として、glass-distortion（SVG filter）を“確実に”Safariだけ無効化する。

### 問題
- CSSの `@supports (-webkit-touch-callout: none)` は macOS Safari では効かない可能性があり、ゆがみOFFが適用されていなかった。

### 実装
- `App.tsx`
  - 起動時に UA/vendor から Safari 判定し、`document.documentElement` に `browser-safari` クラスを付与。
- `index.css`
  - `browser-safari` が付いている時だけ、以下の疑似要素に対して `filter: none` を強制してゆがみOFF。
    - `.screen-idle .glass-thin::after`
    - `.screen-idle .glass::after`
    - `.screen-idle .glass-strong::after`
    - `.screen-idle .editor-glass::after`

### 検証
- `npm test` PASS
