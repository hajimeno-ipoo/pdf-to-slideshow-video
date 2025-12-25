## 2025-12-25

### 目的
- 編集/プロジェクト管理/インスペクターの range スライダーで
  - 進捗（左側）だけアクセント色
  - ドラッグ中だけつまみに薄い青い発光
  を統一して適用（ガラス質感は維持）。

### 変更点
- `index.css`
  - `.screen-idle .idle-range` に `--idle-range-progress` / `--idle-range-progress-color` / `--idle-range-track-color` を追加。
  - `::-webkit-slider-runnable-track` を `linear-gradient(... var(--idle-range-progress))` にして WebKit(Safari/Chrome) でも進捗色が出るようにした。
  - `:active` 時の `::-webkit-slider-thumb` / `::-moz-range-thumb` に青い外側ぼかし(発光)を追加。
  - Firefox の `::-moz-range-track/progress` も同じ変数へ寄せた。

- `App.tsx`
  - `input[type="range"].idle-range` を対象に、value/min/max から `%` を計算して `--idle-range-progress` を `style.setProperty` する `useEffect` を追加。
  - `input` イベント + `MutationObserver` で新規追加されたスライダーも初期化。

- `components/slideEditor/SettingsPanel.tsx`
  - これまで `idle-range` が付いていなかった 4つの range（スライドサイズ/角丸/トランジション/ダッキング音量）に `idle-range` を付与して共通スタイル適用。

### テスト
- 追加: `tests/idleRangeProgress.test.js`（CSS変数/ReactのsetProperty/SettingsPanelのopt-in を文字列で検証）
- 実行: `npm test` / `npm run build` ともに成功。