
import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import ColorPickerPopover from '../ColorPickerPopover';

interface ColorSettingsPanelProps {
  color: string;
  onChange: (color: string) => void;
}

const ColorSettingsPanel: React.FC<ColorSettingsPanelProps> = ({ color, onChange }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="w-full p-4 space-y-3">
      <h4 className="text-white font-bold text-sm">背景色の設定</h4>
      <div className="relative inline-flex">
        <button
          ref={btnRef}
          onClick={() => setOpen(!open)}
          className="h-12 w-12 rounded-md border border-slate-600 shadow-inner"
          style={{ backgroundColor: color }}
        />
        {open && btnRef.current && ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              top: btnRef.current.getBoundingClientRect().bottom + 8,
              left: Math.min(
                window.innerWidth - 340,
                Math.max(8, btnRef.current.getBoundingClientRect().left)
              ),
              zIndex: 9999
            }}
          >
            <ColorPickerPopover
              value={color}
              onChange={onChange}
              onClose={() => setOpen(false)}
            />
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default ColorSettingsPanel;
