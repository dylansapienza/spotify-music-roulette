'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface CountdownProps {
  seconds: number;
  onComplete?: () => void;
  isRunning?: boolean;
  variant?: 'circle' | 'bar';
  size?: 'default' | 'large';
}

// Size configurations for circle variant
const sizeConfig = {
  default: {
    container: 'w-20 h-20',
    viewBox: '0 0 80 80',
    cx: 40,
    cy: 40,
    r: 36,
    strokeWidth: 4,
    circumference: 226,
    textSize: 'text-2xl',
  },
  large: {
    container: 'w-24 h-24',
    viewBox: '0 0 96 96',
    cx: 48,
    cy: 48,
    r: 42,
    strokeWidth: 5,
    circumference: 264,
    textSize: 'text-4xl',
  },
};

export function Countdown({ seconds, onComplete, isRunning = true, variant = 'circle', size = 'default' }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const config = sizeConfig[size];

  useEffect(() => {
    setTimeLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, timeLeft, onComplete]);

  const progress = (timeLeft / seconds) * 100;
  const isLow = timeLeft <= 5;

  // Bar variant - horizontal progress bar with time
  if (variant === 'bar') {
    return (
      <div className="w-full">
        <div className="flex items-center gap-3">
          {/* Time display */}
          <motion.span
            key={timeLeft}
            initial={{ scale: 1.1, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-2xl font-bold tabular-nums min-w-[3ch] ${isLow ? 'text-red-500' : 'text-[#1DB954]'}`}
          >
            {timeLeft}
          </motion.span>
          
          {/* Progress bar */}
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isLow ? 'bg-red-500' : 'bg-[#1DB954]'}`}
              initial={{ width: '100%' }}
              animate={{ 
                width: `${progress}%`,
                boxShadow: isLow ? '0 0 12px rgba(239, 68, 68, 0.6)' : '0 0 8px rgba(29, 185, 84, 0.4)',
              }}
              transition={{ duration: 0.3, ease: 'linear' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Circle variant (default)
  return (
    <div className="flex flex-col items-center">
      <motion.div 
        className={`relative ${config.container}`}
        animate={isLow ? {
          boxShadow: [
            '0 0 20px rgba(239, 68, 68, 0.3)',
            '0 0 40px rgba(239, 68, 68, 0.5)',
            '0 0 20px rgba(239, 68, 68, 0.3)',
          ],
        } : {}}
        transition={isLow ? { duration: 1, repeat: Infinity } : {}}
        style={{ borderRadius: '50%' }}
      >
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox={config.viewBox}>
          <circle
            cx={config.cx}
            cy={config.cy}
            r={config.r}
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            fill="none"
            className="text-white/10"
          />
          <motion.circle
            cx={config.cx}
            cy={config.cy}
            r={config.r}
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            fill="none"
            strokeLinecap="round"
            className={isLow ? 'text-red-500' : 'text-[#1DB954]'}
            strokeDasharray={config.circumference}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: config.circumference - (config.circumference * progress) / 100 }}
          />
        </svg>
        {/* Time display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            key={timeLeft}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`${config.textSize} font-bold ${isLow ? 'text-red-500' : 'text-white'}`}
          >
            {timeLeft}
          </motion.span>
        </div>
      </motion.div>
      {size === 'default' && (
        <span className="text-sm text-white/50 mt-2">seconds</span>
      )}
    </div>
  );
}
