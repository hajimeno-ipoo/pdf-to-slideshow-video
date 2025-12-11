
import React from 'react';

interface ColorSettingsPanelProps {
  color: string;
  onChange: (color: string) => void;
}

const ColorSettingsPanel: React.FC<ColorSettingsPanelProps> = ({ color, onChange }) => {
  return (
    <div className="w-full p-4">
      <h4 className="text-white font-bold text-sm mb-4">背景色の設定</h4>
      <input 
        type="color" 
        value={color} 
        onChange={(e) => onChange(e.target.value)} 
        className="h-12 w-full bg-transparent cursor-pointer rounded" 
      />
    </div>
  );
};

export default ColorSettingsPanel;
