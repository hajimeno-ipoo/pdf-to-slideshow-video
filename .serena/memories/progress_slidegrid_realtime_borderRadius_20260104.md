## 2026-01-04

### 目的
- プロジェクト設定の「角丸半径」変更を、スライド一覧（フレームサムネ）にも“スライダー操作中に”できるだけリアルタイム反映させる。

### 問題
- `SlideEditorContext` の `useEffect([slideBorderRadius])` が cleanup で `setTimeout` を毎回 `clearTimeout` しており、環境や操作速度によっては「止めた時だけサムネ再生成が走る」挙動になりやすい。
- bake後のメタ（`thumbnailBakedScale/thumbnailBakedBorderRadius`）が、実際に使った設定値ではなく closure の値で保存される可能性があった。

### 対応
- `components/slideEditor/SlideEditorContext.tsx`
  - `bakeSettingsRef` を導入し、`updateThumbnail()` に渡す `VideoSettings` を常に最新に近い値で参照。
  - bake中に設定変更が来たら `bakePending` を立てて早めに次ジョブへ（delay 0msで再スケジュール）。
  - `useEffect([slideBorderRadius])` から cleanup を外し、unmount用の cleanup を `useEffect([])` へ分離して「変更のたびにタイマーを消してしまう」状態を回避。
  - bakeメタは `settings.slideScale / settings.slideBorderRadius` を保存するよう修正。

### 検証
- Playwright: 角丸スライダーを連続変更した際、`img[alt="Slide 1"]` などの `src` が複数回更新されることを確認。
- `npm test` 全PASS。