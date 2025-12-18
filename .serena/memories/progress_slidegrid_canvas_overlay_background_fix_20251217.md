## 2025-12-17
- 症状: スライド一覧(サムネ)で、背景(canvas)に画像を追加しても黒が残り背景画像が見えない。
- 原因: `components/slideEditor/SlideGrid.tsx` が `slide.thumbnailUrl` をスライド枠内に表示し、画像オーバーレイも全て同じ枠内(clip)に描いていた。`space:'canvas'` の画像がサムネ全体(黒背景側)に描かれない。
- 対応:
  - `layerOrder` と `space` を見て、canvas-space の画像オーバーレイをサムネ全体のレイヤーとして描画するよう修正。
  - slide-space の画像オーバーレイは従来どおりスライド枠内(clip)に描画。
- 検証: `npm test` / `npm run build` 成功。