## 2025-12-17
- 症状: スライド一覧で、画像オーバーレイが2重に表示される（少しズレて見える）。
- 原因: `SlideInspector` の「適用」で `updateThumbnail()` がオーバーレイ込みの `thumbnailUrl` を生成する一方、`SlideGrid` がGIFアニメ用に同じ画像オーバーレイをDOMで再度重ね描画していたため、焼き込み＋DOMの2枚が同時に表示されていた。
- 対応: `components/slideEditor/SlideGrid.tsx` からオーバーレイ画像の重ね描画（canvasBefore/slideBefore/slideAfter/canvasAfter の `<img>`群）を削除し、一覧は `slide.thumbnailUrl` 1枚に統一。
- 影響: スライド一覧でGIF/APNGのアニメはしなくなるが、2重表示は解消。
- 検証: `npm test` / `npm run build` 成功。