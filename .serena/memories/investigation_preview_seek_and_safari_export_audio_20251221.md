## 2025-12-21 調査メモ（報告用）

### 現象
- 全体プレビュー: BGM/ナレーションは再生できるが、シークバーで飛ばすと音が遅れて追従／停止しても遅れて止まる体感がある。
- 書き出し: Safariで生成したMP4が無音。Chrome生成MP4は音あり。

### 主要証拠
- `/Users/apple/Downloads/Safari.mp4` を `ffprobe` で確認すると音声ストリームはあるが、
  - `Audio: aac (mp4a) 22050 Hz, 0 channels`
  - `Audio object type 0 is not implemented` が出る（= AACのAudioSpecificConfig/ヘッダが壊れている可能性が高い）。
- `/Users/apple/Downloads/Chrome.mp4` は `Audio: aac (LC) 44100 Hz, stereo`。

### コード観点
- プレビューのシーク遅延: `components/PreviewPlayer.tsx` の `handleSeek` が再生中に `setTimeout(..., 120)` してから `playAudio()` を呼ぶため、シーク直後に音が遅れる（仕様的遅延）。
- 書き出し音声: `services/videoWorkerScript.ts` で WebCodecs `AudioEncoder` の `output(chunk, meta)` から `meta.decoderConfig` を拾って `EncodedAudioPacketSource('aac')` に渡してMP4へmux。
  - Safari側の `meta.decoderConfig` が壊れている（sampleRate/description 等）可能性が高く、結果としてMP4のmp4a設定が壊れて再生できない。

### 次の修正方針（案）
- 書き出し: `meta.decoderConfig` を信用せず、アプリ側で固定（mp4a.40.2 / 44100 / 2ch / 正しいAudioSpecificConfig）にする、または description を検証して不正ならfallback。
- プレビュー: シーク時の 120ms デバウンスを「ドラッグ中だけ」にする／クリックジャンプは即時再同期、などで体感遅延を軽減。