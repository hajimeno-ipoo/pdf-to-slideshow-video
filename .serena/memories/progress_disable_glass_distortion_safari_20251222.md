## 2025-12-22
- 目的: Safariだけで発生する“ガラスのちらつき”対策として、glass-distortion（SVG filterによるゆがみ）をSafariでは無効化する。

### 変更
- `index.css`
  - Safari判定（`@supports (-webkit-backdrop-filter: ...)` + `@supports (-webkit-touch-callout: none)`）の中で、以下の `::after` に対して `filter: none` / `-webkit-filter: none` を強制。
    - `.screen-idle .glass-thin::after`
    - `.screen-idle .glass::after`
    - `.screen-idle .glass-strong::after`
    - `.screen-idle .editor-glass::after`
  - ぼかし（backdrop-filter）と半透明は維持し、ゆがみだけOFF。

### 検証
- `npm test` PASS
