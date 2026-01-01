## 2026-01-01

### 変更
- カバーフロー切替スイッチON時の色を青（sky系）に変更
- スライド/グリッド/カバーフローの表示テキストをスイッチの隣に配置（右寄せ）

### 対応内容
- `components/SlideEditor.tsx`
  - ヘッダーを `justify-end` にしてテキスト＋スイッチを並べて表示
  - coverflow時の表示色を `text-sky-400`、スイッチON色を `bg-sky-600/80 border-sky-500/60` に変更
  - スイッチに `idle-toggle-switch` クラスを付与
- `index.css`
  - `.screen-idle .editor-glass button:not(.idle-btn-primary)` の強制背景（!important）から `idle-toggle-switch` を除外し、スイッチの背景色が反映されるように
- `tests/slideGridCoverflow.test.js`
  - `idle-toggle-switch` と sky 色、CSS除外ルールの存在を文字列チェックで追加

### 確認
- PlaywrightでON時スイッチ背景が青になるのを computedStyle で確認
- `npm test` pass