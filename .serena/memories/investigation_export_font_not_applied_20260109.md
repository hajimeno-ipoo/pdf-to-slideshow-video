## 2026-01-09
- 症状: 動画書き出し時に、インスペクター（OverlaySettingsPanel）で選んだフォント（例: Kaisei Decol / Mochiy Pop One / DotGothic16）が反映されず、標準フォントに見える。
- 経路確認:
  - フォント選択: `components/cropModal/constants.ts` の `FONTS` → `components/cropModal/OverlaySettingsPanel.tsx` が `selectedOverlay.fontFamily` を更新。
  - 書き出し: `services/pdfVideoService.ts` が `VIDEO_WORKER_CODE`（`services/videoWorkerScript.ts`）へ slides を渡し、worker 側で OffscreenCanvas に描画してエンコード。
  - worker 描画: `services/videoWorkerScript.ts` の `drawOverlays` が `ctx.font = ... "${overlay.fontFamily}" ...` を設定。
- 原因(推定): Web Worker/OffscreenCanvas 側では、HTML側で読み込んでいる Google Fonts が自動では使えないため、`overlay.fontFamily` が未ロード扱い→ canvas が `sans-serif` にフォールバック。
- 修正案: worker init 時に slides から使用フォントを収集し、Google Fonts CSS を fetch→ `FontFace` + `self.fonts.add()` で必要フォントをロードしてからフレーム生成を開始（FontFace未対応は従来通りフォールバック）。
- 次アクション: ユーザーOK後に最小修正＋ `tests/*` に worker フォントロードの存在を確認する小テスト追加。
- 状態: 修正済み（`progress_fix_export_font_family_20260109`）。