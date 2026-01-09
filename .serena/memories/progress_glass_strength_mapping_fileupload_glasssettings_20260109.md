## 2026-01-09
- 目的: ガラス強さの割り当てを整理（1→2→3の順）。

### 変更
- `components/FileUpload.tsx`:
  - こだわり設定パネル: `glass` → `glass-strong`（フォーム/説明の可読性優先）
  - 下部注意文: 単体テキスト → `glass-thin` のバッジにして読みやすさUP（absoluteのため外側wrapperで配置）

- `components/GlassSettingsModal.tsx`:
  - 背景プレビュー上の「ガラス」小ラベル: `glass` → `glass-thin`（見え方確認の邪魔をしない）

### 検証
- `npm test` PASS（210 tests）
