## 2025-12-13
- 目的: インスペクタ（装飾/画像）の影設定にある X/Y の数値が小さくて見づらい問題を改善。
- 変更:
  - `components/cropModal/OverlaySettingsPanel.tsx` の X/Y ラベルを `text-[10px]` → `text-xs` にし、数値は `text-sm + font-medium + tabular-nums` で読みやすくした。
  - `components/cropModal/ImageSettingsPanel.tsx` も同様に調整。
- 影響: 表示だけの変更（挙動はそのまま）。
- 確認: `npm test` / `npm run build` / `npm run test:coverage` OK。
