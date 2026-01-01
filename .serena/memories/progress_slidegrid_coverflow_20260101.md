## 2026-01-01
- スライド一覧に表示切替（グリッド/カバーフロー）を追加。
  - `components/SlideEditor.tsx` に小さめiOS風スイッチ（`role="switch"` + `aria-checked`）を追加し、`SlideGrid` に `viewMode` を渡す。
  - `components/slideEditor/SlideGrid.tsx` に `viewMode` を追加し、coverflow時は横スクロール + snap + 3D（`rotateY`/`translateZ`/`scale`）演出を適用。
  - coverflowに左右移動ボタン（前へ/次へ）を追加し、中心に近いカードを基準に `scrollIntoView({ inline: 'center' })` で移動。
- テスト追加: `tests/slideGridCoverflow.test.js`
- 実行: `npm test`（pass）