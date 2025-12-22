# APIキー接続不具合修正 実装計画

## 目標
APIキーを入力しても「接続中」にならず、AI機能が使用できない不具合を修正する。
原因である `services/geminiService.ts` における `getUserApiKey` (非同期) の `await` 漏れを解消する。

## ユーザーレビューが必要な事項
特になし。内部ロジックの修正のみ。

## 変更内容

### services

#### [MODIFY] [geminiService.ts](file:///Users/apple/Desktop/Dev_App/pdf-to-slideshow-video/services/geminiService.ts)

1.  **`getClient` 関数の変更**
    *   `const getClient = () => { ... }` を `const getClient = async () => { ... }` に変更。
    *   内部で `getUserApiKey()` を呼び出す際、`await` を追加する。
    
2.  **`checkApiConnection` 関数の変更**
    *   `const ai = getClient();` を `const ai = await getClient();` に変更。

3.  **`generateSpeech` 関数の変更**
    *   `const ai = getClient();` を `const ai = await getClient();` に変更。

4.  **`generateImage` 関数の変更**
    *   `const ai = getClient();` を `const ai = await getClient();` に変更。

5.  **`generateSlideScript` 関数の変更**
    *   `const ai = getClient();` を `const ai = await getClient();` に変更。

## 検証計画

### 手動検証
1.  アプリを起動し、APIキー設定モーダルを開く。
2.  正しいAPIキーを入力して「保存」を押す。
3.  ヘッダーのステータスインジケーターが「緑色（Connected）」になることを確認する。
4.  (可能であれば) PDFアップロードまたはスクリプト生成を試し、エラーが発生しないことを確認する。
