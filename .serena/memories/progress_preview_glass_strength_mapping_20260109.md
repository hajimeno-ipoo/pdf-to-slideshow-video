## 2026-01-09
- 目的: ガラス強さの割り当てを「ステージ=thin、操作列=mid」に整理（プレビューだけ先行）。

### 変更
- `components/PreviewPlayer.tsx`:
  - `preview-stage` を `glass` → `glass-thin` に変更（映像が主役なので薄め）
  - 再生/シーク操作列のコンテナを `glass-thin` → `glass` に変更（操作UIの可読性を確保）

### 検証
- `npm test` PASS（210 tests）
