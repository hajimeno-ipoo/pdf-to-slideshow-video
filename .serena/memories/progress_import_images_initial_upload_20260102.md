# 進捗: 初回アップロードで画像(PNG/JPEG/GIF/WebP)を1枚/複数読み込み（2026-01-02）

## 目的
- 最初のアップロード画面で、PDFだけじゃなく画像も読み込めるようにする。
- 画像は1枚/複数を選べて、1枚=スライド1枚として並ぶ。
- AI台本生成(こだわり設定)もPDFと同じ流れで使える。

## 実装
- `components/FileUpload.tsx`
  - `accept="application/pdf,image/*"` + `multiple` に変更。
  - UI文言を「PDF / 画像をアップロード」に変更。
  - ドラッグ&ドロップ/ファイル選択ともに複数ファイルを親へ渡す。

- `utils/uploadSource.js`
  - `classifyUploadFiles(filesLike)` を追加。
  - PDF(1つ) / 画像(複数可) / エラー を判定してメッセージも返す。
  - PDFと画像の混在はエラー。

- `services/pdfVideoService.ts`
  - `analyzeImages(files, durationPerSlide, transitionType, onProgress, autoGenerateScript, onUsageUpdate, customScriptPrompt)` を追加。
  - 画像を `createSlideFromImage` で順にスライド化し、必要なら `generateSlideScript` で台本を付与。
  - `createSlideFromImage` は拡張子からMIMEを推定して `customImageFile.type` が空になりにくいように正規化。

- `App.tsx`
  - `classifyUploadFiles` で分岐し、PDFは従来通り `analyzePdf`、画像は `analyzeImages` を呼ぶ。

## テスト
- `tests/uploadSource.test.js` を追加（判定ロジックの単体テスト）。
- `npm test` 全パス。

## コミットメッセージ案
- `feat: 初回アップロードで画像(複数)読み込みに対応`