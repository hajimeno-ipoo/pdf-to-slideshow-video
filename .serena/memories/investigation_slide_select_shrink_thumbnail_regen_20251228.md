## 2025-12-28
### 現象
- スライド編集画面でスライドを選択すると、スライド一覧とSlideInspectorプレビューで黒帯(余白)が増えて“縮小した”ように見える。

### 原因(推定・根拠あり)
- SlideInspector の「自動サムネ更新(scheduleThumbnailUpdate→updateThumbnail)」が、編集していないのに“初回選択(マウント)直後”に走って `slide.thumbnailUrl` を差し替えている。
- 差し替え後の `updateThumbnail` 生成画像は 16:9(640x360)キャンバス上に `drawSlideFrame` で `videoSettings.slideScale`(例:95%) を適用して描画するため、周囲に黒背景の余白が増える。
- これが「選択した瞬間に黒い部分が広がる」見え方の原因。

### なぜ初回選択で走るか(技術的メモ)
- SlideInspector マウント時の prop sync(useEffect)で `setLayerOrder(slide.layerOrder || [SLIDE_TOKEN, ...])` が毎回新規配列を生成し、見た目は同じでも参照が変わる→次の auto thumbnail effect で didChange 判定が true になり scheduleThumbnailUpdate が発火しうる。

### 関連箇所
- `components/SlideInspector.tsx`: prop sync / auto thumbnail update / `buildUpdatedSlideForThumbnail` / `updateThumbnail` 呼び出し
- `services/pdfVideoService.ts`: `updateThumbnail` → `drawSlideFrame`(slideScale適用)