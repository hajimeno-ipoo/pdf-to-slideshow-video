## 2025-12-12
- 目的: 書き出し時のメモリ不足対策（ブラウザ固まり防止）。
- 変更: generateVideoFromSlides で PDF を1回だけロードし、ビットマップを作らず PNG ArrayBuffer を生成して転送。背景色スライドも PNG バッファ化。customImageFile も Buffer のみ送る。
- 変更: videoWorkerScript を lazy ロード方式にし、スライド資産は1枚先読み＋使い終わったら close して解放。背景色は worker 内で OffscreenCanvas 生成。bitmap 全保持を廃止。
- ビルド: `npm run build` 成功。
- 期待効果: 同時に保持する画像ビットマップを最大2枚に抑制し、PDF読み込みの重複を削減。メモリピークの大幅低減。

## 2025-12-12 追加（次の対策案）
- 現状のMP4出力は `ArrayBufferTarget` + `fastStart: 'in-memory'` で完成MP4をRAMに全保持するため、長尺でメモリが増えやすい。
- 対策方針: File System Access API（Chromium）を使い、生成中のデータをディスクへストリーミング書き出しに切替（完成物をRAMに置かない）。
- 予定作業: UIで保存先を先に選ぶ → workerを `StreamTarget`/`FileSystemWritableFileStreamTarget` に切替 → main側で書き込み管理 → フォールバック/エラー処理 → 短尺/長尺/取消で動作確認。

## 2025-12-12 追加（MDN互換性メモ）
- File System API は Secure Context 前提かつ Experimental 扱いのため、実装は `isSecureContext` と feature detection（`showSaveFilePicker` の有無など）でガードして、非対応ブラウザは従来方式にフォールバックする。

## 2025-12-12 追加（ライブラリ選定）
- `mp4-muxer` は作者側で deprecated 扱いで、後継として `Mediabunny` 推奨のため、MP4書き出しの新実装は Mediabunny（`StreamTarget` + `Mp4OutputFormat`）を優先する方針。

## 2025-12-12 追加（実装: 案A ストリーミング保存）
- `App.tsx`: MP4かつ対応環境で `showSaveFilePicker` を最初に出して保存先を確定（キャンセル時は何もせず戻る）。
- `services/pdfVideoService.ts`: `generateVideoFromSlides` に `outputFileHandle` を追加して worker に渡す。worker が `savedToDisk` を返した場合は `outputFileHandle.getFile()` からプレビュー用URLを生成。
- `services/videoWorkerScript.ts`: MP4部分を Mediabunny（CDN import）に置換。`outputFileHandle` があれば `StreamTarget(await handle.createWritable())` でディスクへ直書き、なければ `BufferTarget` で従来通りメモリで返す。`fastStart: false`。
- ビルド: `npm run build` 成功。

## 2025-12-12 追加（レビュー指摘の反映）
- `services/pdfVideoService.ts`: `worker.onmessage` を try/catch で包み、URL生成などで例外が出ても `reject` + cleanup されるように修正。
- `services/videoWorkerScript.ts`: MP4のストリーミング保存で、失敗時に `output.cancel()` と `writable.abort()` を試みる finally を追加（中途半端ファイル/ロック残りを減らす）。
- ビルド: `npm run build` 成功。