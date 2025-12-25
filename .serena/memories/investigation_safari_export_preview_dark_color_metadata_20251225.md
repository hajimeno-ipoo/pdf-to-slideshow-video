## 2025-12-25 Safari: 書き出し画面の動画プレビューが暗い — 色メタ情報(レンジ/transfer)起因の検証

### 目的
- ガラス(backdrop-filter/疑似要素)をOFFにしても暗さが直らないというユーザー報告を受け、CSS以外(動画の色メタ情報)の可能性を検証。

### 検証用の動画を作成（同一映像・メタ情報だけ変更）
- 元動画: `/Users/apple/Downloads/kling資料/slideshow2.mp4`（Mediabunny生成のMP4）
- 8秒クリップを2本作成:
  - A: `/Users/apple/Downloads/safari_test_bt709_tv.mp4`
    - `yuv420p / color_range=tv / transfer=bt709 / primaries=bt709`
  - B: `/Users/apple/Downloads/safari_test_srgb_full.mp4`
    - `yuvj420p / color_range=pc / transfer=iec61966-2-1(sRGB) / primaries=bt709`
- 作成方法: `ffmpeg -c copy` + `h264_metadata` bitstream filter で VUI を書き換え（画素は同一）。

### 比較用HTML
- `/Users/apple/Downloads/safari_video_compare.html`
  - 2本を左右に並べて表示（Safariで目視比較用）。

### ブラウザでの計測（Playwright + ローカルHTTP）
- HTML内で video → canvas → luma(平均輝度) を計測。
- 結果（例）:
  - A luma ≒ 237.8
  - B luma ≒ 219.9
  - 差 ≒ -17.9（Bが暗い）

### 結論（推定原因）
- `transfer=iec61966-2-1`（sRGB）や `color_range=pc`（full range）などの色メタ情報の違いだけで、ページ内 `<video>` 表示の明るさが大きく変わることを確認。
- Safariでのみ暗い / PiPで明るい挙動は、Safari内で「HTMLVideoElement表示」と「PiP(AVFoundation)」で色解釈ルートが異なる、もしくは色メタ情報の扱いが異なる可能性が高い。

### 対応案（修正方針案）
- 生成時に bt709 + TVレンジへ揃える（WebCodecs の `VideoEncoderConfig.colorSpace.fullRange=false` 相当を指定できるなら最短）。
- もしくは生成後に H.264 VUI を bt709/tv に補正（ブラウザ内後処理は実装コスト高）。
- 最終手段として Safariのみ CSS `filter` で補正（根本ではない）。