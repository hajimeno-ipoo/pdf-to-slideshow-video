## 2026-01-01
- カバーフローの末尾センタリング修正
  - `components/slideEditor/SlideGrid.tsx` の左右余白を内側コンテナではなくスクロールコンテナの `paddingLeft/Right` + `scrollPaddingLeft/Right` に付与し、最後のスライドも中央に来るように。
- ヘッダー表示テキスト修正
  - `components/SlideEditor.tsx` の表示ラベルをモードに応じて「グリッド」/「カバーフロー」に切替表示。
- 実行: `npm test` pass