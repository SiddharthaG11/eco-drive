
import React from 'react';

interface Props {
  currentSpeed: number;
  recommendedSpeed: number;
  consumption: number;
}

const Speedometer: React.FC<Props> = ({ currentSpeed, recommendedSpeed, consumption }) => {
  const percentage = Math.min((currentSpeed / 160) * 100, 100);
  const recPercentage = Math.min((recommendedSpeed / 160) * 100, 100);
  
  // Power/Regen meter calculation
  // -10kW (Regen) to +50kW (Heavy Acceleration)
  const consumptionNormal = Math.max(-10, Math.min(50, consumption));
  const consPct = ((consumptionNormal + 10) / 60) * 100;

  return (
    <div className="flex flex-col items-center justify-center p-6 glass-panel rounded-3xl relative overflow-hidden h-full">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-green-500 opacity-30"></div>
      
      {/* Speed Display */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Main Gauge Ring */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="128"
            cy="128"
            r="110"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray="691"
          />
          <circle
            cx="128"
            cy="128"
            r="110"
            stroke={currentSpeed > recommendedSpeed + 10 ? '#ef4444' : '#06b6d4'}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray="691"
            strokeDashoffset={691 - (691 * (percentage * 0.75)) / 100}
            className="transition-all duration-500 ease-out"
            strokeLinecap="round"
          />
          {/* Recommended Speed Tick */}
          <line
            x1="128"
            y1="18"
            x2="128"
            y2="38"
            stroke="#22c55e"
            strokeWidth="4"
            transform={`rotate(${(recPercentage * 0.75 * 3.6)}, 128, 128)`}
            className="transition-all duration-1000"
          />
        </svg>

        <div className="absolute flex flex-col items-center">
          <span className="text-7xl font-orbitron font-bold glow-cyan">{Math.round(currentSpeed)}</span>
          <span className="text-sm text-gray-400 font-medium tracking-widest uppercase">km/h</span>
        </div>
      </div>

      {/* Recommended Info */}
      <div className="mt-8 grid grid-cols-2 gap-8 w-full">
        <div className="flex flex-col items-center border-r border-gray-800">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-tighter">Target Speed</span>
          <span className="text-2xl font-orbitron text-green-400">{recommendedSpeed}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-tighter">ECO Mode</span>
          <span className="text-2xl font-orbitron text-cyan-400">Active</span>
        </div>
      </div>

      {/* Consumption / Regen Meter */}
      <div className="w-full mt-6 px-4">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold">
          <span>Regen</span>
          <span className={`${consumption > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            {consumption > 0 ? 'Power' : 'Charging'}
          </span>
          <span>Max</span>
        </div>
        <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-gradient-to-r from-green-500 via-cyan-400 to-orange-500 transition-all duration-300"
            style={{ width: `${consPct}%` }}
          />
        </div>
        <div className="flex justify-center mt-2">
            <span className="text-xs font-orbitron">{consumption.toFixed(1)} kW</span>
        </div>
      </div>
    </div>
  );
};

export default Speedometer;
