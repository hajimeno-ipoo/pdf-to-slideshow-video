## 2026-01-03
- 症状: 装飾/画像/音声タブのプレビューが真っ黒（中身が極小で黒背景だけ見える）
- 原因: 通常表示では previewArea 内寸を測っておらず、canvasステージが内容依存で極小化（約3px）→ 黒く見える
- 対応: `components/SlideInspector.tsx` で previewArea を通常時も計測し、アスペクト比に合わせた `stageBox` を計算して width/height を付与
  - `previewAreaReady` を導入して「通常=常に計測 / 切り離し=ポータル準備後だけ計測」に分岐
  - `stageBox` を `showCanvasStage` のときに適用
- テスト: `npm test -- --runTestsByPath tests/cropReflectInPreviewAndExport.test.js` 実行（PASS）
- Playwright: 装飾タブのプレビュー枠サイズが数px→数百pxに回復することを確認