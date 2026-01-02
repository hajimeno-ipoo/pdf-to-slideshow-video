## 2026-01-02 対応: カバーフローのスワイプ中も glass-distortion をON

### 変更点
- `index.css`
  - `.screen-idle[data-coverflow-scrolling="true"] .editor-glass::after` で、スワイプ中に `filter: none` にしていたのをやめ、`filter: url(#glass-distortion)` のままに変更。

### 結果
- カバーフローでスワイプ中でも、ガラスのゆがみ（glass-distortion）がOFFにならず、常にONの見た目になる。

### テスト
- `npm test` PASS。
