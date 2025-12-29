# 進捗: user_manual.html の表示を規約ページと統一 (2025-12-29)

## 目的
- `public/user_manual.html` を `public/privacy.html` / `public/terms.html` / `public/usage.html` と同じ見た目（特にカード/余白/行間/idleテーマのガラス表現）にそろえる。

## 調査
- `public/user_manual.html` は `scripts/generate-user-manual.mjs` で `USER_MANUAL.md` から生成されているため、HTML直編集ではなく生成スクリプト側のテンプレCSSを合わせるのが正解。

## 対応
- `scripts/generate-user-manual.mjs` の `buildHtml()` 内CSSを、規約ページのCSSに寄せて調整。
  - `p, li` の `line-height` を `1.7`、`p/ul/ol` の `margin` を `8px` に統一
  - `.card` の `border-radius: 12px` / `margin: 12px 0 0` に統一
  - `html.theme-idle .card` のガラス背景（blur/box-shadow/::before）を規約ページと同等に追加
  - `.meta` スタイルを追加
  - `html.theme-idle pre` の背景だけ薄くして可読性を確保
  - `section { margin: 14px 0; }` を追加
- `node scripts/generate-user-manual.mjs` を実行して `public/user_manual.html` を再生成。

## 確認
- Playwrightで `user_manual.html` と `usage.html` を `?theme=idle` で開き、ヘッダー/カードの見た目が揃っていることを確認。