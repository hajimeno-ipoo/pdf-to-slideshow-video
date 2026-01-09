## 2026-01-09 調査: プロジェクト設定のBGM/全体ナレーションがプレビューで鳴らない & BGM波形が消える

### 相談内容
1) プロジェクト設定でBGM/全体ナレーションを追加しても「全体(全画面)プレビュー」でどちらも再生されない。
2) 全体ナレーションを追加したら、BGMの波形が消えて削除もできない。

### コード上の音声フロー（重要箇所）
- 追加UI: `components/ProjectSettings.tsx` / `components/slideEditor/SettingsPanel.tsx`
  - `file.type.startsWith('audio/')` だけチェックして `setBgmFile` / `setGlobalAudioFile` に `File` を入れる。
- 状態: `components/slideEditor/SlideEditorContext.tsx`
  - `bgmFile`, `globalAudioFile` は `useState(File|null)` で保持。
- 波形表示(タイムライン): `components/TimelineEditor.tsx`
  - `bgmFile.arrayBuffer()` → `AudioContext.decodeAudioData()`
  - 失敗時は `catch(e){}` で握りつぶし（ユーザーに分かる表示は出ない）
- 波形編集(サイドバー): `components/BgmWaveformEditor.tsx`
  - `AudioContext.decodeAudioData()` 失敗時は `console.error("Failed to decode audio", e)` のみ。
- 全画面プレビュー: `components/PreviewPlayer.tsx`
  - `bgmFile/globalAudioFile/slide.audioFile` を `decodeAudioData` して `OfflineAudioContext` でミックス→ `AudioContext` で再生。

### 再現確認（Playwright/本番ビルド dist を http.server で起動）
- ✅ 再現できたこと（=原因の強い候補）
  - `decodeAudioData` が対応してない音声だと、波形が0秒表示になり、プレビュー/再生が実質鳴らない。
  - 例: macOS の `/System/Library/Sounds/*.aiff` を入れると Chrome で `EncodingError: Unable to decode audio data` が出た。
    - BgmWaveformEditor: TOTAL が 0:00.0 / 波形も出ない
    - Preview でも音声に乗らない可能性が高い
- ✅ 対応フォーマットの例
  - `/System/Library/PrivateFrameworks/TelephonyUtilities.framework/V2ch_hold_loop.wav` は正常にデコードでき、波形も表示できた。
  - `/System/Library/CoreServices/Language Chooser.app/.../VOInstructions-ja.m4a` も正常にデコードできた。
- ❌ 再現できなかったこと
  - 「全体ナレーション追加でBGMが消える」は、
    - BGM=対応wav + 全体ナレ=対応m4a
    - BGM=対応wav + 全体ナレ=非対応aiff
    どちらでも BGM の state 自体は消えず、ProjectSettings のBGM欄も残った。

### 現時点の結論（報告用）
- (1) の「プレビューで鳴らない」は、まず **音声ファイルのコーデック/形式が WebAudio の decodeAudioData で読めてない** 可能性が高い。
  - DevTools Console に `EncodingError: Unable to decode audio data` が出てたらほぼ確定。
- (2) の「BGM波形が消えて削除もできない」は、本番ビルドでは再現できず。
  - もし“波形だけが空”なら TimelineEditor 側が decode 失敗してるパターン（エラー握りつぶしで気づきにくい）。
  - もし“BGM欄そのものが消えて削除ボタンも無い”なら `bgmFile` が `null` に戻ってるので、
    - 実際はBGMがセットできていない（MIME判定で弾かれてる/別UIで状態がリセット）
    - もしくは UI が「プロジェクト設定」ではなくスライド選択状態のインスペクター表示に切り替わっている
    のどちらかを疑う。

### 追加で確認したい情報（再現条件の特定に必要）
- 使ってる音声の拡張子・コーデック（mp3/wav/m4a/…）
- その時の DevTools Console のエラー（特に decodeAudioData 系）
- 「BGMが消える」は
  - BGM名表示も消える？（=bgmFileがnull）
  - それとも表示は残るけど波形だけ空？（=decode失敗）
