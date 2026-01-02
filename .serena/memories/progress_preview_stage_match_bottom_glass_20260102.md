# 進捗: 全画面プレビューの上部白さをさらに抑える（2026-01-02）

## 背景
- 全画面プレビューの動画枠（canvas）上下余白のうち、上側が下側より白っぽく強く見える。

## 変更内容（最小）
- `index.css` で、`preview-stage` のガラス表現を「下部（glass-thin相当）」に寄せた。
  - `.screen-idle .preview-stage.glass::before`：ツヤ（上方向の白グラデ）を無効化
  - `.screen-idle .preview-stage.glass::after`：背景/blur を `glass-thin` の値に上書き（`--idle-glass-bg-thin` + `--idle-glass-blur-thin`）

## テスト
- `npm test` PASS（173 tests）。
