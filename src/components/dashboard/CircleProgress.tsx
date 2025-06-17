import React from 'react';
import { cn } from '@/lib/utils';

interface CircleProgressProps {
  size?: number;
  progress: number;
  color?: string;
  icon?: React.ReactNode; // Prop for the icon element
  text: string; // Prop for the text
  className?: string;
}

export const CircleProgress: React.FC<CircleProgressProps> = ({
  size = 100,
  progress,
  color = '#4CAF50', // Default color (green)
  icon,
  text,
  className,
}) => {
  const radius = size / 2 - 5; // Subtract a bit for stroke width
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        className="-rotate-90 transform"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="text-gray-300"
          strokeWidth="10"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="progress-ring__circle"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
            stroke: color,
            transition: 'stroke-dashoffset 0.35s',
          }}
        />
      </svg>
      {/* Overlay div for icon and text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {icon && <div className="text-xl mb-1 leading-none">{icon}</div>}
        <div className="text-sm font-medium">{text}</div>
      </div>
    </div>
  );
};
