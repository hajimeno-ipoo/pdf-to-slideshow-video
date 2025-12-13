## 2025-12-13
- 目的: 自動音量調整（ダッキング）の設定で、現在の数値が見えない問題を改善。
- 変更: `components/ProjectSettings.tsx` のダッキング「下げる量」スライダーに、`{Math.round(duckingOptions.duckingVolume * 100)}%` の表示を追加。
  - `components/SlideEditor.tsx` 側は元から%表示があったので変更なし。
- テスト: `npm test` / `npm run test:coverage` / `npm run build` OK。
