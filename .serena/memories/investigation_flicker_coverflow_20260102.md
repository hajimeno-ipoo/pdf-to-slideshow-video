# 調査: 画面チラつき（カバーフロー操作中）再発（2026-01-02）

## 症状（ユーザー申告）
- 画面全体が一瞬フラッシュする/チラつく（スワイプ中に目立つ）。

## 再現条件（コードから）
- 編集画面も `screen-idle` クラスが付く（`App.tsx:1029`）。
  - つまり編集画面でも `--idle-bg-image` の背景画像が出る。
- カバーフロー時は横スクロール + 3D変形（`components/slideEditor/SlideGrid.tsx`）。
- スクロール中、`scroller.closest('.screen-idle')` に `data-coverflow-scrolling="true"` を付けたり外したりする（`components/slideEditor/SlideGrid.tsx:345-402`）。
- ガラス面は `.screen-idle .editor-glass::after` に `backdrop-filter` と `filter:url(#glass-distortion)`（SafariはfilterだけOFF）（`index.css:237-249` / `index.css:6-13`）。

## 今回の環境変化（直近の変更）
- デフォルト背景画像を `Doc/IMG_9349.PNG` に変更。
  - 画像サイズ: 5504x3072（約1690万px）/ ファイル約32MB（PNG）
  - 旧デフォルト: `Doc/f570...png` は 1024x1024（約2.6MB）

## MCP(Chrome DevTools)での切り分け結果
- カバーフローで自動スクロール中のフレーム間隔を簡易計測（rAF + scrollLeft連打）。
  - 背景画像あり: たまに 90ms〜110ms級の大きいフレーム落ちが出る
  - 背景画像を `--idle-bg-image: none` にすると、最大フレーム間隔が25ms程度に収まりやすい
- つまり「背景画像 + ガラス(backdrop-filter等) + カバーフローのスクロール」が重くなって、瞬間的な描画落ち（=フラッシュ/チラつき）に見えてる可能性が高い。

## 推定原因（結論）
- 主因候補: **背景画像が高解像度すぎる**（5504x3072）状態で、編集画面のガラス表現（`backdrop-filter`）が常に背景をサンプリングし続け、カバーフローのスクロール/3D変形で再合成が頻発 → GPU/描画が一瞬落ちてフラッシュ化。
- 追加要因候補: `data-coverflow-scrolling` の付け外し自体がスタイル再計算を誘発（特にSafari/フィルタ周り）。

## すぐできる確認（ユーザー側DevToolsで一発）
1) `document.documentElement.style.setProperty('--idle-bg-image','none')` でスワイプ → チラつき減る？
2) `document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'.editor-glass::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}' }))` → 減る？

※修正はまだしてない（調査報告のみ）。