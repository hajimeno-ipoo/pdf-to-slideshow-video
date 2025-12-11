// 簡易的にキーらしき文字列をマスクするサニタイズ関数
// 英数字が長く続くトークンを "***" に置換する。
// ログやUIメッセージでキーが露出しないように使用する。

export const sanitizeMessage = (msg: any): string => {
  if (msg === null || msg === undefined) return '';
  const str = typeof msg === 'string' ? msg : (msg.message || JSON.stringify(msg));
  // 例: AIza... や 20文字以上の英数字連続
  const pattern = /(AIza[0-9A-Za-z\-\_]{10,}|[0-9A-Za-z]{20,})/g;
  return str.replace(pattern, '***');
};

