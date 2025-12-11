# コードスタイル・方針
- TypeScript前提、`type`/`interface`/`enum` を活用してPropsや状態を厳密管理。
- Reactは関数コンポーネント+Hooks(useState/useEffect/useRef)のみ。JSXは`react-jsx`(React 19)で書く。
- インデントはスペース2、セミコロンあり、シングルクォート多用。
- モジュール解決はViteの`@/*`エイリアスがルートを指す。TS compiler: `moduleResolution: bundler`, `allowImportingTsExtensions: true`。
- PDF.jsはグローバル `pdfjsLib` を想定しCDN workerを設定。
- スタイル/リンター設定ファイルなし(ESLint/Prettier未導入)。既存記法に合わせる。
- ローカル保存やレート計測で`localStorage`を使う。ブラウザAPI中心でNode依存少なめ。