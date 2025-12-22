## 2025-12-22
- 目的: 書き出し中（動画作成中）のプログレスバー進行色を、PDF読み込み中（解析中）と同じ青に統一。

### 修正
- `components/ProcessingStep.tsx`
  - 進捗バー（inner）の色を条件分岐から撤去し、常に `bg-blue-500` に変更。
  - これにより CONVERTING（書き出し中）でも緑→青に統一。

### 検証
- `npm test` PASS
