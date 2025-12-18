## 2025-12-18
- 目的: AIを使う機能を「API接続ステータスが connected の時だけ」有効化（それ以外はロック）

### 実装
- `App.tsx`
  - `aiEnabled = apiStatus === 'connected'` を追加。
  - `FileUpload` と `SlideEditor` に `aiEnabled` を渡す。
- `components/FileUpload.tsx`
  - 「AIでナレーション原稿を自動生成」トグルを `aiEnabled` が false の時に `disabled`。
  - `aiEnabled` が false になったら自動で `autoGenerateScript=false` に戻す。
  - ロック中は補足テキストを表示。
- `components/SlideEditor.tsx` / `components/SlideInspector.tsx`
  - `aiEnabled` をInspectorまで伝播。
- `components/cropModal/AudioSettingsPanel.tsx`
  - 「AI読み上げ」タブ/ボタンと生成ボタン等を `aiEnabled` が false の時にロック。
  - ロック中に `audioMode==='tts'` なら自動で `upload` に戻す。
- `components/cropModal/ImageSettingsPanel.tsx`
  - 「AIで生成」タブ/入力/生成ボタンを `aiEnabled` が false の時にロック。
  - ロック中に `imageMode==='gen'` なら自動で `upload` に戻す。
- `components/CropModal.tsx`
  - Audio/Imageパネルへ `aiEnabled` を渡すためPropsを追加（型整合性のため）。

### 検証
- `npm test` 成功
- `npm run build` 成功

### 仕様
- AI機能は `apiStatus === 'connected'` のときだけ操作可能。
- `checking` / `error` のときはUI上で押せない（ロック表示）。