## 2026-01-02 対応: スライド単体DLが「動画スクショ」になる問題

### 要望
- スライド一覧の個別DLで、背景や動画見た目の合成ではなく、**元のPDFページ/元画像をそのまま**（背景なし・オーバーレイなし・トリミングも反映しない）で保存したい。

### 原因
- `components/slideEditor/SlideGrid.tsx` の `handleDownloadSlideImage` が、動画サイズcanvasを作って
  - `renderBackground(...)` で背景（画像/黒/白）を描画
  - `drawSlideFrame(...)` でスライドを合成
 していたため、DL結果が「動画の1フレーム（スクショ）」になっていた。

### 修正
- `components/slideEditor/SlideGrid.tsx`
  - 画像スライド: `slide.customImageFile` をそのまま `downloadBlob` で保存（トリミング/背景/オーバーレイなし）
  - PDFスライド: `pdfDoc.getPage(slide.pageIndex)` → `page.getViewport({ scale: 1 })` → `page.render(...)` で元ページをそのままPNG保存（トリミング/背景/オーバーレイなし）
  - 元データが無い場合のみ `thumbnailUrl` をフォールバック

### テスト
- `tests/slideGridDownloadImage.test.js` を更新
- `npm test` 成功