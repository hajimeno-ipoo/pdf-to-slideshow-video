## 2025-12-17
- 問題: 画像追加時に画像が大きすぎて拡大縮小しにくい。
- 原因: 以前の修正で canvas 追加画像をデフォルトで「cover」相当にしてしまい、初期 width/height が 1 以上になっていた。
- 対応: `components/SlideInspector.tsx` の画像追加の初期サイズを通常どおり `width:0.3` ベースに戻し、canvasでも扱いやすいサイズから開始するよう修正。
- 検証: `npm test` / `npm run build` 成功。