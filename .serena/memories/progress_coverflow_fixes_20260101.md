## 2026-01-01
- カバーフロー不具合修正
  - 切替時に一覧が切れる問題: `components/SlideEditor.tsx` のカード2を `flex flex-col` 化し、一覧領域を `flex-1 min-h-0` にしてレイアウト崩れを解消。
  - 先頭/末尾が中央に来ない・最後まで行けない問題: `components/slideEditor/SlideGrid.tsx` でスクロール領域幅とカード幅から左右padding（`coverflowEdgePx`）を計算して付与。
  - スクロール時の回転を削除: `rotateY` をやめて `translateZ + scale` のみ。
- テスト更新: `tests/slideGridCoverflow.test.js`（rotateYが含まれないこともチェック）
- 実行: `npm test` pass