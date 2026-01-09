## 2026-01-09
- 目的: 編集画面（SlideEditor/Timeline/Inspector）のガラス階級を thin/mid/strong で一貫させ、見た目より読みやすさ優先で整理する。

### 割り当て（編集画面）
- strong:
  - 右サイドバー（Inspector/ProjectSettings）のヘッダー
  - 上部コントロール（ボタン列）のヘッダー
  - Timeline の Slide Audio（スライドごとの音声）行
- mid:
  - Timeline の Slides 行（サムネ並び）
  - Timeline の Global Audio（全体ナレーション）行
  - Timeline の BGM 行
  - スライド一覧の中身（スクロール領域）
- thin:
  - スライド一覧のヘッダー（背景寄りで主役を邪魔しない）

### 変更
- `components/TimelineEditor.tsx`: Global Audio/BGM を `editor-glass-pane--mid` に、Slide Audio は `editor-glass-pane--strong` を維持。
- `components/SlideEditor.tsx`: スライド一覧を `editor-glass--thin` にし、ヘッダー=thin / 中身=mid に段階化。
- `components/SlideInspector.tsx`: Inspector ヘッダーを `editor-glass-pane editor-glass-pane--strong` に。
- `components/ProjectSettings.tsx`: ProjectSettings ヘッダーを `editor-glass-pane editor-glass-pane--strong` に。

### 検証
- `npm test` PASS（210 tests）
