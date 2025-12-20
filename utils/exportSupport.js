export const getExportSupportError = (win, options = {}) => {
  const requireAudio = !!options.requireAudio;

  if (!win) {
    return 'このブラウザでは動画の書き出しができないよ。対応ブラウザで開いてね。';
  }

  const hasOffscreenCanvas = typeof win.OffscreenCanvas === 'function';
  const hasVideoEncoder = typeof win.VideoEncoder === 'function';
  const hasAudioEncoder = typeof win.AudioEncoder === 'function';

  if (hasOffscreenCanvas && hasVideoEncoder && (!requireAudio || hasAudioEncoder)) {
    return null;
  }

  if (requireAudio && hasOffscreenCanvas && hasVideoEncoder && !hasAudioEncoder) {
    return 'このブラウザでは音あり動画の書き出しができないよ。音を外すか別のブラウザで開いてね。';
  }

  return 'このブラウザでは動画の書き出しができないよ。対応ブラウザで開いてね。';
};
