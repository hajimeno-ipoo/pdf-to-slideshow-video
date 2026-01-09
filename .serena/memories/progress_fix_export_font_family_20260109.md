## 2026-01-09
- 不具合: 動画書き出し(Worker/OffscreenCanvas)で、インスペクターで選択したフォントが反映されず `sans-serif` にフォールバックしていた。
- 原因: `index.html` で読み込んだ Google Fonts は Web Worker には自動で共有されないため、worker の Canvas 描画時にフォント未ロード扱いになる。
- 修正: `services/videoWorkerScript.ts` の worker init で、slides の text overlays から使用フォントを収集し、Google Fonts CSS を fetch → `FontFace` でロード → `self.fonts.add()` する best-effort ローダを追加（CSSの `unicode-range` も反映してサブセットでも文字欠けしにくくした）。フレーム生成前に `await fontsReadyPromise` で待機。
- テスト: `tests/exportFontFamilyWorker.test.js` を追加して、worker がフォント事前ロード処理を持つことを確認。
- コマンド: `npm test` / `npm run test:coverage` ともに成功。