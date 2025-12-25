## 2025-12-25

### 要望
1) トリミングのガイド線を ON/OFF できるようにしたい。
2) ガイド線が白くて見えにくいので、見やすい色にしたい。
3) 比率ロック（1:1）を用意し、Shift 押下中に一時的に切替できるようにしたい（Apple寄せ）。

### 対応
- `components/SlideInspector.tsx`
  - 追加: `cropGuidesEnabled`（ガイド線ON/OFF）
  - 追加: `cropAspectLockSquare`（比率ロック 1:1）
  - Crop UI（activeTab==='crop'）に
    - 「ガイド線」トグル
    - 「比率 1:1」トグル
    - Shift の説明文
    を追加（`idle-segment` スタイルでガラス/Apple寄せ）。
  - ガイド線の見やすさ改善
    - `border-white/70` + `drop-shadow(...)` で白線に影をつけ、明暗どちらの背景でも見えるように。
    - ドラッグ中は少し濃く（opacity）して視認性UP。
  - 比率ロック
    - ON時は1:1でリサイズ。
    - Shift押下中は 1:1 ロックON（ボタンOFFでも一時ロックできます）。

### テスト
- 追加: `tests/cropGuidesAndAspectLock.test.js`
- 実行: `npm test` 成功

### 追記（更新）
- その後、比率はプリセット選択（元/16:9/4:3/1:1/9:16/フリー）に変更し、Shift一時切替は削除。
- 詳細は progress_crop_aspect_presets_handles_20251225 を参照。
