
import { AnimationType } from '../../types';

export const FONTS = [
  { name: 'ゴシック (標準)', value: 'Noto Sans JP' },
  { name: '明朝体', value: 'Noto Serif JP' },
  { name: '手書き風', value: 'Kaisei Decol' },
  { name: 'ポップ体', value: 'Mochiy Pop One' },
  { name: 'ドット文字', value: 'DotGothic16' },
  { name: '英語 (Inter)', value: 'Inter' },
];

export const ANIMATION_VALUES: AnimationType[] = [
    'none', 'fade', 'pop', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'rotate-cw', 'rotate-ccw', 'wipe-right', 'wipe-down', 'typewriter'
];

export const getAnimationLabel = (value: AnimationType, type: 'in' | 'out'): string => {
    if (value === 'none') return 'なし';
    if (value === 'typewriter') return 'タイプライター (文字のみ)';
    
    if (type === 'in') {
        switch (value) {
            case 'fade': return 'フェード (徐々に現れる)';
            case 'pop': return 'ポップ (弾むように)';
            case 'slide-up': return 'スライド上 (下から浮き上がる)';
            case 'slide-down': return 'スライド下 (上から降りてくる)';
            case 'slide-left': return 'スライド左 (左から入ってくる)';
            case 'slide-right': return 'スライド右 (右から入ってくる)';
            case 'zoom': return 'ズーム (拡大して出現)';
            case 'rotate-cw': return '回転 (時計回り)';
            case 'rotate-ccw': return '回転 (反時計回り)';
            case 'wipe-right': return 'ワイプ (左から表示)';
            case 'wipe-down': return 'ワイプ (上から表示)';
        }
    } else {
        switch (value) {
            case 'fade': return 'フェード (徐々に消える)';
            case 'pop': return 'ポップ (弾むように消える)';
            case 'slide-up': return 'スライド上 (上へ消える)';
            case 'slide-down': return 'スライド下 (下へ消える)';
            case 'slide-left': return 'スライド左 (左へはける)';
            case 'slide-right': return 'スライド右 (右へはける)';
            case 'zoom': return 'ズーム (拡大して消失)';
            case 'rotate-cw': return '回転 (時計回り)';
            case 'rotate-ccw': return '回転 (反時計回り)';
            case 'wipe-right': return 'ワイプ (右へ消える)';
            case 'wipe-down': return 'ワイプ (下へ消える)';
        }
    }
    return value;
};

export const parseColor = (color: string | undefined, defaultHex: string = '#000000'): { hex: string, alpha: number } => { 
    if (!color || color === 'transparent') return { hex: defaultHex, alpha: 0 }; 
    if (color.startsWith('#')) return { hex: color, alpha: 1 }; 
    if (color.startsWith('rgba')) { 
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); 
        if (match) { 
            const toHex = (n: number) => n.toString(16).padStart(2, '0'); 
            return { hex: `#${toHex(parseInt(match[1]))}${toHex(parseInt(match[2]))}${toHex(parseInt(match[3]))}`, alpha: match[4] !== undefined ? parseFloat(match[4]) : 1 }; 
        } 
    } 
    return { hex: defaultHex, alpha: 1 }; 
};
