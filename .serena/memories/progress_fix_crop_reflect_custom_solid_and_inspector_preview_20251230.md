## 2025-12-30

### 症状
- トリミング後、インスペクター（装飾/画像/音声）のプレビューがトリミング範囲とズレる（特に x/y=0 のとき古い値に戻ることがある）。
- 画像追加/無地スライドでトリミングがスライド一覧・全体プレビュー・書き出しに反映されない。

### 原因
- `components/SlideInspector.tsx` のキャンバス表示で `crop?.x || slide.crop?.x` のような `||` を使っており、`0` を「未設定」扱いして古い値にフォールバックしていた。
- `components/SlideInspector.tsx` の `getSlideAspect()` がローカル編集中の `crop` ではなく `slide.crop` を参照しており、未適用のトリミングで比率がズレやすかった。
- `services/pdfVideoService.ts` で custom image/solid の bitmap 生成が `slide.crop` を反映していなかった（PDFは前段で切り抜き済みbitmap前提）。

### 対応
- `services/pdfVideoService.ts`
  - `createImageBitmapWithCrop()` を追加し、custom image は `slide.crop` で切り抜いた ImageBitmap を返すように修正（プレビュー/サムネ用）。
  - solid は `slide.crop` の比率/サイズに合わせた bitmap を作るように修正（サムネ/書き出し用）。
- `components/SlideInspector.tsx`
  - `getSlideAspect()` をローカル `crop` 優先に変更。
  - `cropX/cropY` などのフォールバックを `??` に変更して `0` を正しく扱う。

### テスト
- `tests/cropReflectInPreviewAndExport.test.js` 追加。
- `npm test` PASS
- `npm run build` PASS
