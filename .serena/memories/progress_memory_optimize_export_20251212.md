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

## 2025-12-13
- 出力形式: GIFを廃止して MP4/MOV に変更。
- 編集画面（プロジェクト設定）に「保存先を設定」ボタンを追加。
  - Secure Context + `showSaveFilePicker` がある環境のみ有効。
  - Safari/Firefox 等は MP4/MOV 書き出しを無効化し、Chrome/Edge 推奨を表示。
- 保存先は「最後に設定した1つだけ」を保持して使い回し。
  - `FileSystemFileHandle` とフォーマットを状態として保持し、autosave（IndexedDB）にも保存。
  - 再編集で編集画面に戻っても設定が残る。
- 「書き出し」ボタンはダイアログ無しで設定済み保存先へディスク直書き。
  - App側で書き込み権限をチェック（`requestPermission` 等）。
- 完了画面:
  - プレビューは書き出し後の動画（mp4/mov）。
  - 「ダウンロード」ボタンは「サムネ画像を書き出す（PNG）」に変更。
- worker:
  - Mediabunny の `StreamTarget` + `Mp4OutputFormat/MovOutputFormat`（`fastStart:false`）で直書き。
- テスト:
  - `utils/fileSystemAccess.js` を `node --test --experimental-test-coverage` で 100% カバー。
- ビルド: `npm run build` 成功。


## 2025-12-13 追加（サムネ書き出し強化）
- 書き出し完了画面の「サムネ画像を書き出す」から、小さい設定ダイアログを表示。
  - 時間指定（○秒）: 指定時刻のフレームをPNGで1枚ダウンロード。
  - 範囲指定（○秒〜○秒）: 範囲を等間隔で最大20枚にしてPNGを作り、ZIPでまとめてダウンロード（圧縮レベル0）。
- ZIP生成は `fflate` をCDNから動的importして使用（依存追加なし）。
- 追加ユーティリティ: `utils/thumbnailExport.js`（時間クランプ/ファイル名/20枚タイム生成）
- 単体テスト: `tests/thumbnailExport.test.js` 追加、`npm run test:coverage` で `utils/thumbnailExport.js` を 100% カバー。
- ビルド: `npm run build` 成功。


## 2025-12-13 追加（サムネZIP tainted対策）
- `canvas.toBlob()` が `SecurityError`（Tainted canvases）で落ちる環境があり、ZIP生成が止まる問題が出た。
- 対策: 動画プレビューからのキャプチャが失敗したら、自動でスライドの `thumbnailUrl`（data URL）からファイル化して 1枚/ZIP を作るフォールバックを追加。
  - フォールバック時は「動画のその瞬間のフレーム」ではなく「その時間に当たるスライドのサムネ」になる（でも確実に落とせる）。
- 検証: `npm test` / `npm run test:coverage` / `npm run build` OK。


## 2025-12-13 追加（サムネ画質の改善）
- tainted回避フォールバックがプレビュー用 `thumbnailUrl`（低解像度）を使っていたため、落とした画像が荒く見える問題が出た。
- 対策: tainted時は「スライド元（PDF/画像/無地）を出力サイズで再レンダ → PNG作成 → 1枚/ZIP」を行う。
  - PDFは `scale <= 3.0`（動画生成と同等）でレンダして、動画と同じくらいの画質を狙う。
  - 失敗したら最終フォールバックとして従来の `thumbnailUrl` を使う。
- 検証: `npm test` / `npm run build` OK。


## 2025-12-13 追加（シークタイムアウト対策）
- サムネ作成で動画プレビューを `currentTime` シークすると、環境/長尺によって `seeked` が返らず「シークタイムアウト」が出ることがあった（1枚/ZIPどちらでも）。
- 対策: tainted と同様に、シーク失敗（タイムアウト/失敗）もフォールバック対象にして、スライド元（PDF/画像/無地）を高画質レンダしてPNGを作る。
- 追加: シーク先が `duration` ぴったりだと詰まりやすいので、`duration - 0.05s` までに丸める。
- 検証: `npm test` / `npm run build` OK。
