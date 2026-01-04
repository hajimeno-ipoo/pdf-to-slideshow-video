## 2026-01-03

### 目的
- インスペクター（装飾/画像/音声のキャンバス表示）で、右下など端が切れて見える問題を修正。
- 方針: `videoSettings.slideScale` を反映して中央寄せ + ステージborder 1px分を内側基準にして 1px切れを無くす。

### 原因
- キャンバスステージの `stageSize` を `getBoundingClientRect()`（border込み）で扱っていたため、子要素（スライド枠）が内側(content)より大きい計算になり、右端が 1px だけ `overflow:hidden` で切れる。
- さらに、デフォルトのスライド枠計算が `slideScale` を無視してステージいっぱい(100%)で表示していたため、端の要素がギリギリになりやすい。

### 対応
- `components/SlideInspector.tsx`
  - ステージサイズ計測を「borderを引いた内寸」に変更（computedStyleのborder幅を差し引く）。
  - `getDefaultSlideRectPx()` で `videoSettings.slideScale` を反映し、ステージ中央に収める。

### 検証
- `npm test` 実行（PASS）
- Playwrightで装飾タブの `slideRect` がステージ内に収まり、`rightOverflow` が正→負（切れ無し）になることを確認。

## 2026-01-04

### 追加の目的
- インスペクター（装飾/画像/音声）のプレビューも「書き出し/全体プレビューと同じ描画パイプライン」に寄せて、見た目（角丸/位置/スケール）を揃える。

### 追加対応
- `services/pdfVideoService.ts`
  - `updateThumbnail()` に `options?: { skipOverlays?: boolean }` を追加。
  - インスペクタープレビュー用に `skipOverlays: true` で「スライド本体だけ」のフレーム画像を生成できるようにした。
- `components/SlideInspector.tsx`
  - `framePreviewUrl` を追加し、`updateThumbnail(..., { skipOverlays: true })` の PNG(640x360) をプレビューに使用。
  - 画像はステージ(=キャンバス)全体を `left=-slideRect.x/top=-slideRect.y` で切り出して、スライド枠にぴったり合わせる。
  - スライド枠の角丸は「表示スケール」に合わせて `stageSize.width / 640` で縮尺（フレーム画像の角丸と一致させる）。

### 追加検証
- Playwright: `sample/Kling_O1_Unified_Multimodal_Engine.pdf` で装飾タブ表示 → 右下ロゴ（NotebookLM）が欠けない＆PNGフレームが使われていることを確認。
- `npm test` 実行（173件PASS）。
