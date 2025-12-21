## 2025-12-21

### 対応
- Safariで書き出したMP4が無音（実態: AACトラック設定が壊れて再生できない）
- 全体プレビューでシークすると音が遅れて追従／停止が遅れて体感する

### 修正内容
- `services/videoWorkerScript.ts`
  - WebCodecs `AudioEncoder` の `meta.decoderConfig` を信用せず、muxに渡す `decoderConfig` を固定（`mp4a.40.2` / 44100Hz / 2ch / 正しいAudioSpecificConfig）。
  - `AudioData` を `f32-planar` で生成（Safari互換を上げる）。
- `components/PreviewPlayer.tsx`
  - シークバーの pointer 操作で「シーク中は一旦pause、指を離したら即再開」方式に変更。
  - `pausePlayback()` で seekデバウンスタイマーを確実にクリア。
  - `handleSeek` の再生判定を `isPlayingState` ではなく `isPlayingRef.current` に変更（イベント順のズレ対策）。
- `tests/safariExportAndSeekFix.test.js`
  - 上記修正が入っていることの最低限チェック（ファイル内容のスモークテスト）。

### テスト
- `npm test` OK
- `npm run test:coverage` OK

### 期待結果
- Safari書き出しMP4が QuickTime/Safari でAAC音声として認識される（例: 44100Hz stereo）。
- プレビューでシーククリック/ドラッグ後の音ズレ・停止遅れの体感が軽減。