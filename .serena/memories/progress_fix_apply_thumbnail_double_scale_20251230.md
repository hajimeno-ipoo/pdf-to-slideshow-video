## 2025-12-30

### 症状
- インスペクターで「トリミング→装飾」に切り替えるとプレビューが縮小して見える（slideScale=95%が反映されるため）。
- 「適用」後にスライド一覧のサムネが“さらに縮小したように見える”ケースがある。

### 原因
- 「適用」時に `updateThumbnail()` が `drawSlideFrame()` で **16:9(640x360)のフレーム画像(PNG)** を生成し、その中で `settings.slideScale` を適用してスライドを縮小して描画している。
- 一方、`SlideGrid` は一覧表示側で常に `transform: scale(videoSettings.slideScale/100)` をかけており、
  `updateThumbnail` 生成サムネ（すでに slideScale 反映済み）に対して **slideScale が二重に適用**されていた。

### 対応
- `types.ts`: `Slide.thumbnailIsFrame?: boolean` を追加。
- `components/SlideInspector.tsx`: 適用時に `updatedSlide.thumbnailIsFrame = true` を付与。
- `components/slideEditor/SlideGrid.tsx`: サムネが frame(16:9 PNG 640x360) の場合は一覧側の `transform: scale(...)` を無効化。
  - 既存プロジェクト互換のため、`thumbnailIsFrame` が未設定でも `data:image/png;base64` の PNGヘッダ(IHDR)から 640x360 を検出して frame とみなす。

### テスト
- `npm test` PASS
- `npm run build` PASS

### 変更ファイル
- `types.ts`
- `components/SlideInspector.tsx`
- `components/slideEditor/SlideGrid.tsx`
- `tests/inspectorAutoApplyUndoRedo.test.js`
