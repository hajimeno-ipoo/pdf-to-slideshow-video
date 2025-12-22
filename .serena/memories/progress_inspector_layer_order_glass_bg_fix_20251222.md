## 2025-12-22
- 目的: SlideInspector の「重なり順」エリアが黒っぽく見える問題を、IDLE白ガラスに馴染むように改善。

### 原因
- `bg-slate-800/40` は `.screen-idle .editor-glass` の背景上書き対象（/30,/50,/60など）に含まれておらず、暗い背景が残っていた。

### 修正
- `components/cropModal/ImageSettingsPanel.tsx`
  - 重なり順コンテナ: `bg-slate-800/40` → `bg-slate-800/30`
- `components/cropModal/OverlaySettingsPanel.tsx`
  - 重なり順コンテナ: `bg-slate-800/40` → `bg-slate-800/30`

### 検証
- `npm test` PASS
