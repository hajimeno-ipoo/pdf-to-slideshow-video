## 2025-12-17 調査: スライド一覧サムネの「内側の黒」が残る
- 現象: スライド一覧のスライド枠の中で、背景画像を設定しても黒い余白(黒帯)が残るケースがある。
- 主要因(根っこ): `components/SlideInspector.tsx` の「適用」で `updateThumbnail()` を呼び、`services/pdfVideoService.ts` で canvas を `toDataURL('image/jpeg')` している。`drawSlideFrame()` は背景を塗らず、スライド画像矩形外は透明のままになるため、JPEG化で透明が黒に潰れて黒帯がサムネに“焼き込み”される。
- 追加要因: `components/slideEditor/SlideGrid.tsx` の枠内余白埋めは `canvasBgUrl`(canvas-space かつスライドより下の画像オーバーレイ)のみを拾う実装。新規画像は layerOrder の末尾に入りがちで `canvasBefore` に入らず、結果として枠内に背景が敷けず黒が見える。
- 対策案(未実装): `updateThumbnail()` で本番と同様に背景(色/背景画像)を先に塗ってから `drawSlideFrame()` を実行する、もしくはPNG出力で透明を保持してSlideGrid側の背景を見せる。