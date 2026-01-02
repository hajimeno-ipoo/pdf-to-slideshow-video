## 2026-01-01 対応: 背景処理(画像)の全体プレビュー表示ズレを修正

### 直したこと
- `components/PreviewPlayer.tsx` の「bgAnimUrl（アニメ背景）」表示で、背景<img>が stage 全面基準になってたのを、**動画枠(キャンバス)と同じサイズ/位置**になるように変更。
  - 中央配置 + `videoDims(width/height)` + `scale` を使って canvas と同じ見た目に合わせた
  - `objectFit: 'cover'` 固定（黒帯/ズレを出さない）
  - `max-w-none max-h-none` を付けて Tailwind の img縮小ルールの影響を回避

### 確認（Playwright）
- 背景処理=画像、`10_fullscreen_preview.png` を設定 → 「全画面プレビュー」
- アスペクト比: 16:9 / 4:3 / 1:1 / 9:16 で、背景<img>のRectとcanvasのRectがほぼ一致（差は1〜2px程度）
- 解像度: 1080p / 720p でも同様に一致

### テスト
- `tests/previewPlayerAnimatedBackgroundSizing.test.js` を追加（旧contain実装が残ってないこと + 新実装のキーワード確認）
- `npm test` で全テストOK