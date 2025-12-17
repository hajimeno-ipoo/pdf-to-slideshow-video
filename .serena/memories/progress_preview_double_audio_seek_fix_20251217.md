## 2025-12-17
- 症状: 全体プレビューでシークバーを連続操作するとナレーション等が二重再生っぽくなる。
- 原因: `components/PreviewPlayer.tsx` の `handleSeek` が `async` な `playAudio(t)` を await せず連打で並列実行され、古い `playAudio` が後から `src.start()` してしまう（stopAudioは最新参照しか止められない）。
- 対応: `previewPlayTokenRef` を追加し、`stopAudio()` でトークンを進めて in-flight の `playAudio` をキャンセル。`renderPreviewAudio()` 後と `src.start()` 前にトークン一致チェック。`handleSeek` は `await playAudio(t)` に。
- テスト: `npm test` pass。