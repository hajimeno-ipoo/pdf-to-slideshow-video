## 2025-12-25

### 目的
- スライド追加の無地追加まわりで、カラーピッカーを開くボタンも選択色が分かるようにする。
- `screen-idle .editor-glass button` の `background: ... !important` に負けない表示にする。

### 変更点
- `components/slideEditor/Toolbar.tsx`
  - カラーピッカー表示ボタン（`colorBtnRef`）を self-closing から通常の `<button>...</button>` に変更。
  - ボタン内にスウォッチ `<span style={{ backgroundColor: solidAddColor }} />` を入れて、選択色が常に見えるようにした。
  - `aria-label` を追加。

### テスト
- 既存 `tests/solidColorAddButtonSwatch.test.js` が通ることを確認（`npm test` 成功）。