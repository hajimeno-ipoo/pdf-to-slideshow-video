## 2025-12-25

### 要望
- スライド一覧（SlideGrid）で、各スライドを「オーバーレイ込み」で画像として個別ダウンロードしたい。

### 対応
- `components/slideEditor/SlideGrid.tsx`
  - 操作ボタン列（複製/削除の横）に「画像を保存」ボタンを追加
  - `slide.thumbnailUrl`（一覧で表示しているプレビュー＝オーバーレイ込み）を DataURL→Blob に変換し、`a.download` で保存
  - ファイル名: `slide_001.png` のように連番

### テスト
- 追加: `tests/slideGridDownloadImage.test.js`
- 実行: `npm test` 成功

### 追記（更新）
- DLボタンはカード下ではなく、各カード右上に「⤓」として配置（ホバー時だけ表示）。
- 保存は `thumbnailUrl` 直保存ではなく、`drawSlideFrame` + `renderSlideToImage` で動画解像度のPNGを生成（オーバーレイ込み、高画質）。
- 失敗時のみ `thumbnailUrl` をフォールバックで保存。
