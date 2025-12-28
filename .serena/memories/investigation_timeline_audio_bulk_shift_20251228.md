## 2025-12-28

### 要望
- スライドごとのナレーション音声（Slide Audio）を、タイムライン上で「時間指定で一括移動」したい。
- 追加オプション: 音声をずらした分だけ、スライド表示時間も伸ばしたい。

### 現状の仕組み（確認）
- スライド音声は `Slide.audioFile` と `Slide.audioOffset`（スライド開始からの秒）で管理。
  - `types.ts` に `audioOffset?: number` が定義。
- タイムライン表示/ドラッグ
  - `components/TimelineEditor.tsx` の Slide Audio 行で、`offsetPx = (audioOffset||0) * scale` により表示位置を決定。
  - ドラッグ中は `audioOffset` を更新し、mouse up で `onUpdateSlides(localSlides)` により親へ確定。
  - `audioOffset` は現状 UI 上 `>=0` にクランプされている。
- プレビュー/書き出し
  - `components/PreviewPlayer.tsx` と `services/pdfVideoService.ts` で、音声の開始時間は `cursor + (audioOffset||0)`。
  - 全体音声(globalAudio)は `start(0)`、BGMも `start(0, loopStart)` で、タイムライン上の「開始遅延」概念は現状なし。

### 実装案（候補）
#### A) 一括移動 = 全スライドの `audioOffset` に同じ秒数Δを足す（最小）
- 例: Δ=+1.0 なら、音声開始が全スライドで一律 1.0 秒後ろへ。
- `newOffset = max(0, (oldOffset||0) + Δ)` で負値防止。
- 変更範囲は基本 `TimelineEditor`（UI + 計算）で完結しやすい。

#### B) 「全ての音声」を本当に対象にする（Slide + Global + BGM）
- 新しいオフセット（開始遅延）を project 側に追加する必要あり。
  - 例: `globalAudioOffset`, `bgmOffset` を `ProjectData` に追加し、serialize/deserialize/PreviewPlayer/pdfVideoService/TimelineEditor に反映。
- BGM は `src.start(bgmOffset, loopStart)` のように開始時間をずらせる。

### スライド表示時間を伸ばすオプション案
- 目的は、音声を後ろにずらした結果「次のスライドにかぶる」「動画末尾で切れる」を減らすこと。
- 候補:
  1) 仕様通り: Δ>0 のとき、音声があるスライドは `duration += Δ`（音声が元々収まっていた前提なら、ずらしても収まりやすい）。
  2) 末尾だけ: Δ>0 のとき、最後のスライドだけ `duration += Δ`（全体長を+Δして末尾カットだけ防ぐ）。
  3) 必要分だけ: `duration >= audioOffset + audioDuration` を満たすように不足分だけ伸ばす（`audioDurations` キャッシュを利用）。

### 仕様決めの確認ポイント
- 「全ての音声」の範囲: スライド音声だけ？ Global/BGM も？
- 「時間指定」: ずらす量（Δ秒）？ それとも開始を絶対秒に合わせる？
- スライド時間延長の対象: 音声のあるスライド全て？最後だけ？不足時のみ？
