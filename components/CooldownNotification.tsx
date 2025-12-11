
import React, { useEffect, useState, useRef } from 'react';

interface CooldownNotificationProps {
  isActive: boolean;
  remainingMs: number;
  reason?: string;
}

const CooldownNotification: React.FC<CooldownNotificationProps> = ({ isActive, remainingMs, reason }) => {
  const [displayTime, setDisplayTime] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const endTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isActive && remainingMs > 0) {
      setVisible(true);
      endTimeRef.current = Date.now() + remainingMs;
      setDisplayTime(remainingMs);

      if (intervalRef.current) clearInterval(intervalRef.current);
      
      intervalRef.current = window.setInterval(() => {
        const left = Math.max(0, endTimeRef.current - Date.now());
        setDisplayTime(left);
        if (left <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 50); // High refresh rate for smooth countdown
    } else {
      // Small delay before hiding to let user see "0.0s"
      if (intervalRef.current) clearInterval(intervalRef.current);
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, remainingMs]);

  if (!visible) return null;

  const seconds = (displayTime / 1000).toFixed(1);
  const maxTime = Math.max(1000, remainingMs); // Avoid division by zero
  const progress = Math.min(100, (displayTime / maxTime) * 100);

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[200] animate-fade-in-down w-[90%] max-w-sm">
      <div className="bg-amber-900/90 backdrop-blur-md border border-amber-600/50 text-amber-100 px-4 py-3 rounded-xl shadow-2xl flex flex-col gap-2 relative overflow-hidden">
        {/* Background Progress Bar */}
        <div 
            className="absolute bottom-0 left-0 h-1 bg-amber-500 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
        />
        
        <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-400">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                </svg>
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-sm text-white flex justify-between items-center">
                    <span>APIクールダウン中</span>
                    <span className="font-mono text-amber-300 text-lg">{seconds}<span className="text-xs text-amber-500/80 ml-0.5">s</span></span>
                </h4>
                <p className="text-xs text-amber-200/70 mt-0.5">
                    {reason || 'APIの利用制限を回避するため待機しています...'}
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CooldownNotification;
