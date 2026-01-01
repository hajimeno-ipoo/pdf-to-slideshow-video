## 2026-01-01

### 問題
- カバーフローで最後のスライドが中央に来ない（最後まで行けない）

### 原因（Playwrightで計測）
- スクロール要素に `paddingRight` を付けても、実際の `scrollWidth` に右側の余白が効かず、`maxScrollLeft` が足りなかった
- さらに `perspective` を内側コンテナに付けていたので、`perspective-origin` が超横長コンテナ基準になり、端のカードが見た目上ズレやすかった

### 修正
- `components/slideEditor/SlideGrid.tsx`
  - 余白（`coverflowEdgePx`）は内側のカード列に付与
  - 内側のカード列を `inline-flex` にして右側余白が `scrollWidth` に反映されるように
  - `perspective: 1200px` はスクロール要素側へ移動（見た目の中心ズレ防止）

### 確認
- Playwrightで `scrollLeft=max` 時に最初/最後カード中心が画面中心に揃うのを数値で確認
- `npm test` pass