## 2025-12-21

### 依頼
書き出し完了画面のボタン文言を短くして改行しないようにし、ボタンサイズ/形状/色も見直す。

### 対応
- `App.tsx` の完了画面ボタンを更新
  - 「動画をダウンロード」→「動画ダウンロード」
  - 「サムネ画像を書き出す」→「画像ダウンロード」
  - 「再編集する」→「再編集」
- レイアウト/スタイル
  - `sm:flex-wrap` + `whitespace-nowrap` + `sm:shrink-0` でボタン内の改行を防止（狭い幅ではボタン自体が折り返される）
  - `px/py` を少し小さくし、`rounded-2xl` / `font-semibold` に統一

### テスト
- `tests/exportButtonsUi.test.js` を追加
- `npm test` / `npm run test:coverage` OK