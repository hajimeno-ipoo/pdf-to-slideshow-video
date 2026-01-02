# 進捗: 全画面プレビュー上部の白さを軽減（2026-01-02）

## 背景
- 全画面プレビューの動画枠（canvas）上下の余白が、上だけ真っ白に見える。
- 原因は `preview-stage` が `glass` で、ガラスのツヤ（`::before` の上方向グラデ + 内側グロー）が強く見えていたため。

## 変更内容（最小）
- `index.css` にて、全画面プレビューの `preview-stage` だけ `glass::before` のツヤを無効化。
  - `.screen-idle .preview-stage.glass::before { background: none; box-shadow: none; }`

## ねらい
- 上下の余白を同じガラス表現に寄せて、「上だけ真っ白」をなくす。

## テスト
- `npm test` PASS（173 tests）。
