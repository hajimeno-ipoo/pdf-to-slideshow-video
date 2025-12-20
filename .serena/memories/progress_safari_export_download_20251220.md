## 2025-12-20
- 目的: Safari対応の書き出し（保存先設定削除・ダウンロード追加・音抜け防止）。
- 変更: File System Access（showSaveFilePicker/保存先設定）を撤去。outputFileHandle/outputFileFormatの状態・型・保存データ・UI・テストを削除。
- 変更: 書き出しは常にメモリ出力（BufferTarget）に統一。workerは保存先分岐を削除。
- 変更: 書き出し前に WebCodecs + OffscreenCanvas のサポートをチェック（音ありの場合はAudioEncoder必須）。
  - util: utils/exportSupport.js を追加。
  - SlideEditor/Appでサポートエラー時にアラートで停止。
- 変更: 完了画面に「動画をダウンロード」ボタン追加。
- 変更: 音声エンコードでエラーが出たら成功扱いしない（AudioEncoder error/decoderConfig欠如でエラー）
- テスト: `npm run test:coverage` 実行済み。