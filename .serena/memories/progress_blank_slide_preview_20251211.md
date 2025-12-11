## 2025-12-11
- 症状: 無地スライドに画像オーバーレイを追加すると、スライドインスペクタの画像タブで真っ黒のまま編集不可。適用後グリッドでは表示される。
- 原因: 無地スライドは solidRef のサイズ取得が初期レンダで0のまま再レンダリングが走らず、screenRect が幅0/高さ0になりオーバーレイ描画領域が消えていた。
- 修正: SlideInspector に SOLID_PREVIEW_WIDTH を導入し、無地スライドのプレビューサイズを 400px 基準でフォールバック。screenRect は solidRef の実寸が取れない場合でも幅/高さを返すよう変更。solidRef のスタイルも幅400px（max-width:100%）に固定。
- 影響ファイル: components/SlideInspector.tsx。
- テスト: npm run build 成功。ブラウザ動作は再確認を推奨。