## 2026-01-02 対応: インスペクター表示中にスライド削除ボタンが見えない

### 現象
- 右側の「プロジェクト設定/インスペクター」を開いた状態だと、スライド一覧カードの下部「削除」ボタンがカード内で切れて見えなくなる。

### 原因
- `components/slideEditor/SlideGrid.tsx` のカードが `overflow-hidden` で、下部コントロール列がカード幅より少しだけはみ出していた。
- 特に「切り替え効果」の表示部分が flex の `min-width:auto` で縮められず、右側（複製/削除）が押し出されてクリップされていた。

### 修正
- `components/slideEditor/SlideGrid.tsx` の「切り替え効果」コンテナに `min-w-0` を追加して、テキストがちゃんと縮んで省略されるようにした。
  - これで右側ボタンがカード内に収まり、削除ボタンも見える。

### 確認
- Playwright でカードRectと削除ボタンRectを計測し、ボタンがカード内に収まることを確認。

### テスト
- `tests/slideGridCoverflow.test.js` に `min-w-0 group/select` の存在チェックを追加
- `npm test` 成功