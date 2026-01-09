## 2026-01-08

### 症状
- 全体プレビューで画像オーバーレイが引き伸ばされて見える（縦横比が崩れる）。
- 一覧/インスペクター/書き出しで見た目の基準が揃わず、違和感が出る。

### 原因
- DOM表示側の `objectFit` と、書き出し（canvas描画）の `drawImage(w,h)` が「縦横比を保つ」実装になっていなかった。

### 対応
- 画像オーバーレイを **縦横比維持（contain）** に統一。
  - `components/PreviewPlayer.tsx`: 画像オーバーレイ `objectFit: 'contain'`
  - `components/SlideInspector.tsx`: 画像オーバーレイ `objectFit: 'contain'`
  - `services/pdfVideoService.ts`: 画像オーバーレイ描画を `Math.min(targetW/imgW, targetH/imgH)` の contain スケールで描画
  - `services/videoWorkerScript.ts`: 書き出し（Worker）側も同じ contain スケールで描画

### テスト
- `npm test` PASS（182件）
- 追加テスト: `tests/overlayImageAspectContain.test.js`

### 変更ファイル
- `components/PreviewPlayer.tsx`
- `components/SlideInspector.tsx`
- `services/pdfVideoService.ts`
- `tests/overlayImageAspectContain.test.js`
