## 2026-01-04

### 目的
- プロジェクト設定の「スライド縮小」スライダーを動かした瞬間に、スライド一覧の見た目がリアルタイムに変わるようにする（フレームサムネでもOK）。
- インスペクターの「最大化 → 戻す」後にプレビューが黒くなる問題を直す。

### 対応内容
#### 1) スライド縮小のリアルタイム反映（一覧）
- 問題: インポート直後に `updateThumbnail()` で全スライドをフレームサムネ化しているため、一覧側は `transform: none` 扱いになり、`slideScale` を変えても見た目が即時に変わらなかった。
- 対応:
  - `Slide` にサムネ生成時点の設定を保持するフィールドを追加
    - `thumbnailBakedScale?: number`
    - `thumbnailBakedBorderRadius?: number`
  - フレームサムネの表示スケールを「現在の slideScale / サムネが焼かれた slideScale」の比で補正して、一覧が即時に追従するようにした。
  - サムネ再生成（`scheduleBakeFrameThumbnails`）は `slideScale` 変更では走らせず、`slideBorderRadius` 変更時のみ（200ms）に実行するようにした。

- 反映箇所:
  - `App.tsx`: インポート時 bake に `thumbnailBakedScale/thumbnailBakedBorderRadius` を付与
  - `components/SlideInspector.tsx`: 「適用」で bake したときに同フィールドを更新
  - `components/slideEditor/SlideEditorContext.tsx`: 再生成 bake でも同フィールドを更新
  - `components/slideEditor/SlideGrid.tsx`: `displayScale` を ratio で計算

#### 2) インスペクター最大化→戻すで黒くなる
- 原因: `previewArea` のサイズ計測 `useLayoutEffect` が、最大化/戻しで ref が差し替わるケースに追従できず、stage が極小になっていた。
- 対応: `components/SlideInspector.tsx` の previewArea 計測 effect の依存に `previewDetachedOpen` を追加して、戻し後も再計測するように修正。

### 検証
- Playwright: スライド縮小を 95→80→60 と変更して、一覧サムネの `transform` が即時に `scale(80/95)`, `scale(60/95)` へ変わることを確認。
- Playwright: インスペクターで「装飾」→ 最大化 → 戻す後もプレビュー領域が正常サイズで表示されることを確認。
- `npm test` 全PASS。