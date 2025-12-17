/**
 * crop で切り抜いた領域が target にピッタリ入るように、元画像をどう配置するかを計算するよ。
 *
 * @param {object} args
 * @param {number} args.originalWidth
 * @param {number} args.originalHeight
 * @param {{x:number,y:number,width:number,height:number}} args.crop
 * @param {number} args.targetWidth
 * @param {number} args.targetHeight
 * @returns {{left:number, top:number, width:number, height:number, scale:number}}
 */
export const getCroppedImageLayoutPx = ({
  originalWidth,
  originalHeight,
  crop,
  targetWidth,
  targetHeight,
}) => {
  const cropW = crop?.width || 1;
  const cropH = crop?.height || 1;
  const scaleX = cropW ? (targetWidth / cropW) : 1;
  const scaleY = cropH ? (targetHeight / cropH) : scaleX;
  const scale = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : (Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1);

  const ow = Number.isFinite(originalWidth) && originalWidth > 0 ? originalWidth : cropW;
  const oh = Number.isFinite(originalHeight) && originalHeight > 0 ? originalHeight : cropH;
  const x = crop?.x || 0;
  const y = crop?.y || 0;

  return {
    left: -x * scale,
    top: -y * scale,
    width: ow * scale,
    height: oh * scale,
    scale,
  };
};

