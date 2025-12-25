# 2025-12-25 Safari: 書き出し画面の動画プレビューが暗い（色メタ情報起因）— 修正

## 対応内容
- MP4(H.264)の色メタ情報が原因で Safari の HTML `<video>` だけ暗く表示される問題に対し、生成後バッファの SPS(VUI) を補正する処理を追加。
- 補正内容（SPS VUI）:
  - `video_full_range_flag` を 0（TVレンジ）へ
  - `colour_primaries` / `transfer_characteristics` / `matrix_coefficients` を 1（BT.709）へ
  - 既存フィールドが存在する場合のみ上書き（長さは変えず、ビット単位で in-place 変更）

## 変更ファイル
- `utils/mp4AvcColorPatch.js`
  - MP4内の `avcC` を走査し、SPS NAL を解析して VUI の色関連フィールドを in-place で書き換えるユーティリティを追加。
  - API: `patchMp4AvcColorToBt709TvInPlace(buffer)`
- `services/pdfVideoService.ts`
  - worker `type==='done'` で `Blob` 作成前に、`extension==='mp4'` のときだけ上記パッチを適用（try/catchで安全に無視）。
- `tests/mp4AvcColorPatch.test.js`
  - Node test runnerでユーティリティの単体テスト追加。

## テスト
- `npm test` / `npm run test:coverage` 実行しパス。
- `utils/mp4AvcColorPatch.js` は line 100% を確認。