## 2026-01-09
- 追加機能: ユーザーがフォントファイル（.woff2/.woff/.ttf/.otf）をアップロードして、テキスト装飾に使えるようにした（プロジェクトに保存して残る）。

### UI
- 追加: インスペクターのテキスト設定（フォント欄）に「＋追加」ボタンを追加。追加後はそのフォントを自動選択。`components/cropModal/OverlaySettingsPanel.tsx`
- 管理: プロジェクト設定に「フォント（追加分）」一覧＋削除ボタンを追加。削除時は該当フォントを使ってるテキストを `Noto Sans JP` に置換して安全にフォールバック。`components/ProjectSettings.tsx`

### 保存/復元
- `types.ts` に `CustomFont` と `ProjectData.customFonts` を追加。
- autosave(IndexedDB) と JSON export/import の両方で customFonts を保存/復元するように拡張。`components/slideEditor/SlideEditorContext.tsx` / `utils/fileUtils.ts`
- 概算サイズ計算にフォントファイル分も含めるように更新。`utils/projectMetaUtils.js`

### 書き出し
- 書き出し時に customFonts の ArrayBuffer を worker に渡し、worker で `FontFace` 登録してから描画するよう対応。`services/pdfVideoService.ts` / `services/videoWorkerScript.ts`

### テスト
- 新規: `utils/customFontUtils.js` を追加し、`tests/customFontUtils.test.js` でカバー。
- 更新: `tests/projectMetaUtils.test.js` を customFonts 分で更新。
- `npm test` / `npm run test:coverage` OK。