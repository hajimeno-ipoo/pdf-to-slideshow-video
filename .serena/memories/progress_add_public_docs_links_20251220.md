## 2025-12-20
- Doc配下のMarkdown（`Doc/USAGE_ONEPAGE.md`, `Doc/TERMS_PUBLIC_RELAXED.md`, `Doc/PRIVACY_PUBLIC_RELAXED.md`）を元に、`public/usage.html`, `public/terms.html`, `public/privacy.html` を追加。
- `components/Header.tsx` に「利用について / 利用規約 / プライバシーポリシー」へのリンクを追加（`import.meta.env.BASE_URL` を使い、`base: './'` の相対配信でも動くように）。
- `npm test` と `npm run build` を実行して成功を確認。