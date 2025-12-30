## 2025-12-29
- 課題: PDFアップロードでAI原稿生成した後、インスペクター(音声→AI読み上げ)の「読み上げテキスト」にスライド1枚目の原稿しか反映されない。

### 原因
- `components/cropModal/AudioSettingsPanel.tsx` で `ttsText` がローカルstateのままスライド切替に追従せず、`initialScript` 変更時に `ttsText` が空のときだけ反映する条件になっていた。

### 対応
- `components/cropModal/AudioSettingsPanel.tsx`
  - `useEffect([initialScript])` 内で `setTtsText(initialScript || '')` を毎回実行し、スライド切替時に各スライドの原稿が読み上げテキストへ入るよう修正。
- `tests/audioSettingsPanelInitialScriptSync.test.js`
  - 上記の同期ロジックが入っていることを確認するテストを追加。

### テスト
- `npm test` OK