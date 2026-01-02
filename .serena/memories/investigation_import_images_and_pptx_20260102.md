# 調査: 画像(PNG/JPEG)・PPTXの読み込み対応可否（2026-01-02）

## 1) PNG/JPEG 等の画像読み込み（1枚/複数）
- 現状の初回アップロードUIはPDF限定（`components/FileUpload.tsx` で `application/pdf` 固定、PDF以外は弾く）。
- ただし内部には「画像ファイル→スライド化」の実装が既にある：`services/pdfVideoService.ts` の `createSlideFromImage` が `customImageFile` を持つ `Slide` を生成。
- 生成した `Slide` は `generateVideoFromSlides(sourceFile: File | null, ...)` が `customImageFile` を優先して処理するため、`sourceFile=null` の「画像だけプロジェクト」でも動画生成可能。
- プロジェクト保存も `utils/fileUtils.ts` が `customImageFile` を base64 で serialize/deserialize しているため成立。
- なので機能追加としては「FileUploadを image/* と multiple に対応して、選ばれた画像を `createSlideFromImage` で配列生成し編集画面へ」すれば実現可能。

## 2) PPTX読み込み＋文字/図形をそのまま編集
- 現状のスライド基盤は「PDFページ or 画像ファイルをビットマップ化して背景にし、上にオーバーレイを載せる」設計（`types.ts` の `Slide` は `customImageFile` / `thumbnailUrl` / `overlays`）。
- そのため PowerPoint のテキストボックス等を「そのまま編集」するには、PPTX内のオブジェクト（テキスト/図形/レイアウト/フォント/改行/テーマ等）を解析→編集可能なデータ構造として保持→再レンダリングする必要があり、別アプリ級の大改修。
- PPTXを「画像として取り込む（編集はこのアプリのオーバーレイで上書き）」なら、PPTX→画像化の手段が必要。
  - ブラウザ内だけで完結させるなら、PPTXをzipとして展開（例: JSZip）→レンダリングするライブラリ導入が候補。ただし再現度・対応要素・依存（jQuery等）・重量のリスクが大きい。
  - サーバー側変換（LibreOffice等）なら再現度は上げやすいが、「ファイルはサーバーに送らない」方針を崩す。
- 結論: 「PPTXの取り込み」自体は“画像化まで”なら条件付きで可能だが、「読み込んでそのまま文字等を編集」は現状アーキテクチャでは現実的に不可。