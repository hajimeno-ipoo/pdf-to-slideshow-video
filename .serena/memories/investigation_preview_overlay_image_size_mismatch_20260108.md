## 2026-01-08 調査メモ

### 症状
- スライド一覧（SlideGrid）＋インスペクター（SlideInspector）と、全体プレビュー（PreviewPlayer）で「画像オーバーレイ」の見た目サイズが一致しない。
- 特に縦長画像（例: `sample/アニメ.png` 768x1344）で差が顕著。

### 原因（確度高）
- **全体プレビューだけ**、画像オーバーレイの `<img>` が `objectFit: 'contain'`。
  - `components/PreviewPlayer.tsx:321-331` 付近
- 一方で、インスペクターは `objectFit: 'fill'`（= 枠いっぱいに引き伸ばし）。
  - `components/SlideInspector.tsx:1622-1624` 付近（canvas stage/DOM overlay）
  - `components/SlideInspector.tsx:2046` 付近（非canvas stage）
- さらに、書き出し/サムネ生成側（canvas描画）も `ctx.drawImage(img, ..., w, h)` で **指定幅/高さにストレッチ**（= fill相当）。
  - `services/pdfVideoService.ts:290-297`

### なぜ「サイズが違う」に見えるか
- `objectFit: contain` は画像の縦横比を守って枠内に収めるので、枠（w,h）が画像比率と合っていないと「小さく」見える。
- `objectFit: fill` / `drawImage(w,h)` は枠いっぱいに伸ばすので、同じ w/h でも見た目が変わる。

### 修正方針案（未実施）
- 方向性A（最小・整合性優先）: 全体プレビューの画像オーバーレイを `objectFit: 'fill'` にして、インスペクター/サムネ/書き出しと合わせる。
- 方向性B（見た目優先）: 書き出し/サムネ/インスペクター側も `contain` 相当に揃える（canvas描画ロジック変更が必要）。

### 確認手順案
- `sample/アニメ.png` を画像追加→スライド一覧/インスペクター/全体プレビューで見た目が揃うか確認。