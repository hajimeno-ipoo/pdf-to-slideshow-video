export const getProjectImportError = (file, { maxBytes = 100 * 1024 * 1024 } = {}) => {
  if (!file) return 'ファイルが選ばれてないよ。';

  const size = Number(file.size);
  if (Number.isFinite(size) && size <= 0) return 'ファイルが空っぽだよ。';
  if (Number.isFinite(size) && Number.isFinite(maxBytes) && maxBytes > 0 && size > maxBytes) {
    return `ファイルが大きすぎるよ（最大${maxBytes}バイトまで）。`;
  }

  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  const isJson =
    name.endsWith('.json') || type === 'application/json' || type === 'text/json';
  if (!isJson) return 'プロジェクト（.json）のファイルを選んでね。';

  return null;
};

export const getProjectJsonTextError = (jsonText, { allowedVersions = [1] } = {}) => {
  const text = String(jsonText ?? '');
  if (!text.trim()) return 'ファイルが空っぽだよ。';

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return 'JSONの形がこわれてるっぽい…。';
  }

  const v = raw?.version;
  if (!allowedVersions.includes(v)) {
    return `このプロジェクトのバージョン（version=${String(v)}）は対応してないよ。`;
  }

  return null;
};
