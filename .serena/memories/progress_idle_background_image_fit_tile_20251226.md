- 背景画像（画像モード）の表示オプションに「画面フィット」「タイル（並べて表示）」を追加。
- Prefs: `utils/glassPrefs.ts` に `backgroundImageDisplay: 'custom' | 'fit' | 'tile'` を追加（default: custom）。
- 反映: `computeIdleGlassCssVars` が
  - fit: `--idle-bg-size: contain`, `--idle-bg-position: center`, `--idle-bg-repeat: no-repeat`
  - tile: `--idle-bg-repeat: repeat`（size/positionは既存のスライダー値を利用）
  - custom: 既存通り（no-repeat）
  を返す。
- CSS: `.screen-idle` の `background-repeat` を `var(--idle-bg-repeat)` に変更し、デフォルトは `no-repeat`。
- UI: `components/GlassSettingsModal.tsx` の背景(画像)に「表示：自由 / 画面フィット / タイル」を追加。fit選択時は大きさ/位置スライダーは非表示。
- テスト: `tests/glassPrefs.test.js` 更新、`npm test` PASS（120 tests）。