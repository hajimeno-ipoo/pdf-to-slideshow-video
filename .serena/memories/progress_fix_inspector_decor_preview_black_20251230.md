## 2025-12-30

### 症状
- トリミング後に装飾タブへ切り替えると、プレビューが黒いまま／表示がバラバラに見える。

### 原因
- PDFのプレビュー用画像（overview / 切り抜き描画）をCanvas→JPEG化する際、Canvasの透明部分が黒っぽく潰れる。
  - `renderPageOverview()` と `renderSlideToImage()` の PDF 描画で、`page.render()` 前に白背景を塗っていなかった。

### 対応
- `services/pdfVideoService.ts`
  - `renderPageOverview()` の PDF 描画前に `ctx.fillStyle='#ffffff'` + `fillRect` を追加。
  - `renderSlideToImage()` の PDF 描画前に `tempCtx.fillStyle='#ffffff'` + `fillRect` を追加。

### テスト
- `tests/cropReflectInPreviewAndExport.test.js` に白背景fillの検証を追加。
- `npm test` PASS
- `npm run build` PASS
