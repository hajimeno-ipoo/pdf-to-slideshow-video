## 2026-01-08
- 症状: インスペクターの「画像追加」で追加した画像が要素一覧で「背景」扱いになり、スライドの大きさ変更→適用後に全体プレビューで画像が小さく見える/位置ズレっぽくなる。
- 原因: `components/SlideInspector.tsx` の `handleAddOverlay('image')` で `space: isCanvasMode ? 'canvas' : undefined` を付けており、画像が canvas-space(背景扱い)として追加されていた。canvas-space は `components/PreviewPlayer.tsx` で動画全体サイズ基準で描画されるため、スライド枠変更と連動しない。
- 対応: 画像追加で `space` を付与しない（=常にスライド要素として追加）。背景画像は「プロジェクト管理」の背景処理側で扱う前提のまま。
- テスト: `tests/inspector_add_image_is_slide_element.test.js` を追加し、画像追加ブロックに `space:'canvas'` が入らないことを確認。`npm test` / `npm run test:coverage` パス。