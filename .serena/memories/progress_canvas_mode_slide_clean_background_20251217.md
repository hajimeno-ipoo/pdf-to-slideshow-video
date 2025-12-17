## 2025-12-17
- キャンバス編集モードでスライド枠に `slide.thumbnailUrl`（オーバーレイ焼き込み済み）を表示していたため、スライド上オーバーレイと重なって“二重に見える”問題を修正。
- 対応:
  - `components/SlideInspector.tsx` のキャンバス編集 `__SLIDE__` 枠の画像を、`overviewImage`（オーバーレイ無しのページ画像）を `crop` で切り抜いて表示する方式に変更（`overviewImage` が無い場合は従来どおり `thumbnailUrl`）。
  - 切り抜き配置計算を `utils/cropPreviewUtils.js` の `getCroppedImageLayoutPx` に切り出し。
  - 単体テスト `tests/cropPreviewUtils.test.js` を追加。
- 検証:
  - `npm test` / `npm run build` ともに成功。