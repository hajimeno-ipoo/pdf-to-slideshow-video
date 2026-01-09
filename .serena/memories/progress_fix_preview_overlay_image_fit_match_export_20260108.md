## 2026-01-08

### 症状
- スライド一覧/インスペクターと全体プレビューで、画像オーバーレイの見た目サイズが違う（全体プレビューだけ小さく見えることがある）。

### 原因
- 全体プレビュー（`components/PreviewPlayer.tsx`）の画像オーバーレイだけ `objectFit: 'contain'` で、他（インスペクター/書き出し canvas）は fill 相当だった。

### 対応
- `components/PreviewPlayer.tsx` の画像オーバーレイを `objectFit: 'fill'` に変更し、書き出し（`drawImage(w,h)`）と見た目を揃えた。

### 検証
- `npm test` PASS（179件）。

### 変更ファイル
- `components/PreviewPlayer.tsx`
