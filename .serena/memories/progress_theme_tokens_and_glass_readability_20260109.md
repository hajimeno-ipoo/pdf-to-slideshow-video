## 2026-01-09
- 目的: (1) ガラス効果を「見た目＜読みやすさ」で3段階化し、文字コントラストを安定させる。(2) テーマ上書き（色/影など）を整理し、CSS変数中心に寄せて触る場所を減らす。

### 実施内容
- `index.css`:
  - 先頭にグローバルのテーマトークン（CSS変数）と、Tailwindユーティリティ上書き（`.bg-slate-*`/`.border-*`/`.text-*`/`.shadow*`など）を集約。
  - `index.html` にあったスクロールバー/scrollbar-hide/keyframes も `index.css` に移動。
  - `.screen-idle` のガラス変数を調整（sat/blur/bg alpha/shine）し、薄/中/強の差をより明確に。
  - ガラス枠/区切り線/影を変数化（`--idle-glass-border`/`--idle-glass-divider`/`--idle-glass-shadow`）して一貫性を上げた。

- `index.html`:
  - テーマ上書き用の `<style>` ブロックを削除（`index.css` に集約）。

### 検証
- `npm test` (node --test) 実行で PASS（210 tests）。

### 変更ファイル
- 変更: `index.css`, `index.html`