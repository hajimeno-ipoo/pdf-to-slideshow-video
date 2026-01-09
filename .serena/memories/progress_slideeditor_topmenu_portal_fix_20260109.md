## 2026-01-09
- 症状: 編集画面の「ファイル/編集」ドロップダウンが、Toolbar の「一括設定(全スライド適用)」の後ろに隠れて見えない。

### 原因
- `.screen-idle .editor-glass > * { z-index: 1; }`（`index.css:375`）により、編集画面内の子要素が同じスタックで重なり、Toolbar側が前に出てメニューが埋もれる。

### 修正
- `components/SlideEditor.tsx`:
  - `ReactDOM.createPortal(..., document.body)` + `position: fixed` + `zIndex: 9999` でトップメニューをbody直下へ表示するよう変更。
  - ボタンの `getBoundingClientRect()` から位置を計算し、スクロール/リサイズでも追従。
  - 外側クリック/ESCで閉じる判定に、ポータル側の要素も含めた。

### 検証
- `npm test` PASS（210 tests）
