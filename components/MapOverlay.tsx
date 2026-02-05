
import React from 'react';
import { RouteOption } from '../types';

interface Props {
  routes: RouteOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  destinationName: string;
}

const MapOverlay: React.FC<Props> = ({ routes, selectedId, onSelect, destinationName }) => {
  const selectedRoute = routes.find(r => r.id === selectedId);

  return (
    <div className="relative w-full h-full glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
      <div className="absolute inset-0 bg-[#0a0a0a]">
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }}></div>
        
        <svg className="w-full h-full opacity-40" viewBox="0 0 1000 600">
           {/* Primary Route Path */}
           <path 
             d="M 100 500 Q 300 100 600 350 T 900 150" 
             fill="none" 
             stroke={selectedId === '1' ? '#06b6d4' : '#222'} 
             strokeWidth={selectedId === '1' ? "8" : "3"}
             strokeLinecap="round"
             className="transition-all duration-500"
           />
           {/* Alternate Route 2 Path */}
           <path 
             d="M 100 500 Q 400 600 700 300 T 900 150" 
             fill="none" 
             stroke={selectedId === '2' ? '#06b6d4' : '#222'} 
             strokeWidth={selectedId === '2' ? "8" : "3"}
             strokeLinecap="round"
             className="transition-all duration-500"
           />
           
           {/* Current Position Marker */}
           <circle cx="100" cy="500" r="14" fill="#06b6d4" className="animate-pulse" />
           <circle cx="100" cy="500" r="5" fill="white" />
           
           {/* Destination Marker */}
           <circle cx="900" cy="150" r="12" fill="transparent" stroke="#22c55e" strokeWidth="2" />
           <circle cx="900" cy="150" r="5" fill="#22c55e" />

           {/* Charging Stops Waypoints (Synthetic Placement for selected route) */}
           {selectedRoute?.chargingStops?.map((stop, idx) => {
             // Logic: Divide the synthetic path area visually
             const step = 800 / (selectedRoute.chargingStops!.length + 1);
             const xPos = 100 + (idx + 1) * step;
             // Rough Y approximation based on the average curve
             const yPos = 350; 
             
             return (
               <g key={stop.id} className="animate-bounce" style={{ animationDelay: `${idx * 0.2}s` }}>
                  <rect x={xPos - 10} y={yPos - 10} width="20" height="20" rx="4" fill="#f97316" />
                  <path d={`M ${xPos} ${yPos-4} L ${xPos-2} ${yPos+1} L ${xPos+2} ${yPos+1} L ${xPos} ${yPos+6}`} fill="white" />
                  <text x={xPos} y={yPos + 25} className="text-[10px] fill-orange-400 font-bold text-center" textAnchor="middle">
                    RECHARGE {stop.kmAt}KM
                  </text>
               </g>
             );
           })}
        </svg>

        <div className="absolute bottom-8 left-8 flex flex-col gap-3 z-10">
          {routes.map(route => (
            <button
              key={route.id}
              onClick={() => onSelect(route.id)}
              className={`px-5 py-3 rounded-2xl transition-all flex items-center gap-4 ${
                selectedId === route.id ? 'bg-cyan-500/20 border border-cyan-500/50 shadow-xl' : 'bg-black/60 border border-white/10'
              }`}
            >
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-widest">{route.name}</div>
                <div className="text-[10px] text-gray-400">
                  {route.distanceKm}km • {route.durationMin}m • {route.chargingStops?.length || 0} stops
                </div>
              </div>
              {route.distanceKm > 100 && (
                <span className="text-[8px] bg-orange-500/20 text-orange-400 px-2 py-1 rounded border border-orange-500/30">WAYPOINTS REQD</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapOverlay;
