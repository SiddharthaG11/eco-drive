
import React, { useState, useEffect } from 'react';
import Speedometer from './components/Speedometer';
import MapOverlay from './components/MapOverlay';
import { RouteOption, EVState, ChargingStop } from './types';
import { optimizeRoute, getEfficiencyTip, EnhancedRouteOption } from './services/geminiService';

const MAX_VEHICLE_RANGE = 100;

const App: React.FC = () => {
  const [routes, setRoutes] = useState<EnhancedRouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [destinationInput, setDestinationInput] = useState('VIT Chennai');
  const [activeDestination, setActiveDestination] = useState('VIT Chennai');
  const [efficiencyTip, setEfficiencyTip] = useState<string>('System Check: 100km Range Enforced');
  const [userLoc, setUserLoc] = useState<{ latitude: number, longitude: number } | undefined>();
  
  const [evState, setEvState] = useState<EVState>({
    currentSpeed: 0,
    recommendedSpeed: 80,
    batteryPercent: 100,
    rangeKm: MAX_VEHICLE_RANGE,
    maxRangeKm: MAX_VEHICLE_RANGE,
    efficiencyWhKm: 150,
    instantConsumptionKw: 0
  });

  const processRangeFeasibility = (rawRoutes: EnhancedRouteOption[]): EnhancedRouteOption[] => {
    return rawRoutes.map(route => {
      const stops: ChargingStop[] = [];
      if (route.distanceKm > MAX_VEHICLE_RANGE) {
        const numStops = Math.floor(route.distanceKm / MAX_VEHICLE_RANGE);
        for (let i = 1; i <= numStops; i++) {
          stops.push({
            id: `stop-${i}`,
            kmAt: i * MAX_VEHICLE_RANGE,
            label: `⚡ Charging Stop ${i} (${i * MAX_VEHICLE_RANGE}km)`
          });
        }
      }
      return { ...route, chargingStops: stops };
    });
  };

  const fetchRoutes = async (target: string, location?: { latitude: number, longitude: number }) => {
    setIsUpdating(true);
    try {
      const rawRoutes = await optimizeRoute(target, evState.batteryPercent, location);
      const routesWithStops = processRangeFeasibility(rawRoutes);
      
      setRoutes(routesWithStops);
      setIsSimulated(routesWithStops.some(r => r.isSimulated));
      
      const optimal = routesWithStops.find(r => r.isOptimal) || routesWithStops[0];
      setSelectedRouteId(optimal.id);
      setActiveDestination(target);
    } catch (error) {
      console.error("Critical Failure in Routing:", error);
      // Even if everything fails, clear loading state
    } finally {
      setIsUpdating(false);
      setLoading(false);
    }
  };

  const handleRefreshLocation = () => {
    if (navigator.geolocation) {
      setIsUpdating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLoc(loc);
          fetchRoutes(activeDestination, loc);
        },
        (err) => {
          console.error("Location error:", err);
          fetchRoutes(activeDestination, userLoc);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      fetchRoutes(activeDestination, userLoc);
    }
  };

  useEffect(() => {
    handleRefreshLocation();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEvState(prev => ({
        ...prev,
        currentSpeed: Math.max(0, prev.currentSpeed + (Math.random() - 0.5) * 4),
        instantConsumptionKw: 8 + (Math.random() * 12),
        rangeKm: Math.max(0, MAX_VEHICLE_RANGE * (prev.batteryPercent / 100))
      }));
    }, 1000);

    const tipTimer = setInterval(async () => {
      if (!isSimulated) {
        const tip = await getEfficiencyTip(evState.currentSpeed, evState.batteryPercent);
        setEfficiencyTip(tip);
      } else {
        setEfficiencyTip("Drive smoothly to maximize your simulated range.");
      }
    }, 25000);

    return () => {
      clearInterval(timer);
      clearInterval(tipTimer);
    };
  }, [evState.currentSpeed, evState.batteryPercent, isSimulated]);

  const handleDestinationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (destinationInput.trim()) {
      fetchRoutes(destinationInput.trim(), userLoc);
    }
  };

  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  const needsRecharge = selectedRoute && selectedRoute.distanceKm > MAX_VEHICLE_RANGE;
  const numStops = selectedRoute?.chargingStops?.length || 0;
  const arrivalTime = selectedRoute ? new Date(Date.now() + selectedRoute.durationMin * 60000) : null;

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-cyan-400 font-orbitron tracking-widest text-lg uppercase">Range Feasibility Check...</div>
          <div className="text-gray-500 text-sm italic">Constraint: Max 100km per Charge</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#050505] p-4 gap-4 overflow-hidden">
      <header className="flex justify-between items-center px-6 py-3 glass-panel rounded-2xl h-20 shadow-xl border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="flex flex-col min-w-[100px]">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Travel Duration</span>
            <span className="text-lg font-orbitron text-cyan-400">
              {selectedRoute ? `${selectedRoute.durationMin} MINS` : '--'}
            </span>
          </div>
          <div className="h-10 w-[1px] bg-white/10"></div>
          
          <div className="flex items-center gap-3">
            <form onSubmit={handleDestinationSubmit} className="flex items-center gap-2">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">Route Destination</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-lg pl-3 pr-10 py-1.5 text-sm font-semibold focus:outline-none focus:border-cyan-500/50 transition-all w-48 md:w-80"
                  />
                  <button type="button" onClick={handleRefreshLocation} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400">
                    <svg className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isUpdating} className="mt-4 p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-all">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </form>
          </div>
        </div>

        <div className="flex items-center gap-10">
           {isSimulated && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Simulated Mode</span>
              </div>
           )}

           {needsRecharge && (
             <div className="bg-orange-500/20 border border-orange-500/40 px-4 py-2 rounded-xl flex items-center gap-3 animate-pulse">
                <div className="p-1.5 bg-orange-500 rounded-lg">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-orange-400 uppercase tracking-tighter">In-Leg Charging</span>
                  <span className="text-[11px] text-white font-bold leading-none">STOPS: {numStops}</span>
                </div>
             </div>
           )}

           <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">ETA</span>
              <span className="text-lg font-orbitron text-white">{arrivalTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '--:--'}</span>
           </div>

           <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Battery</span>
                <span className="text-lg font-orbitron text-green-400">{evState.batteryPercent}%</span>
              </div>
              <div className="w-14 h-7 border border-white/20 rounded-md flex items-center p-0.5 relative">
                 <div className="h-full bg-green-500 shadow-[0_0_10px_#22c55e66] rounded-sm transition-all duration-1000" style={{ width: `${evState.batteryPercent}%` }} />
                 <div className="absolute -right-1.5 w-1.5 h-3.5 bg-white/30 rounded-r"></div>
              </div>
           </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          <div className="flex-1">
            <MapOverlay 
              routes={routes} 
              selectedId={selectedRouteId} 
              onSelect={setSelectedRouteId} 
              destinationName={activeDestination}
            />
          </div>

          <div className="glass-panel p-6 rounded-3xl grid grid-cols-4 gap-6 border border-white/5 shadow-xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Total Distance</span>
                <span className={`text-xl font-orbitron ${needsRecharge ? 'text-orange-400' : 'text-cyan-400'}`}>
                  {selectedRoute?.distanceKm} km
                </span>
                <div className="flex items-center gap-1 mt-1 opacity-60">
                   <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                   <span className="text-[9px] text-gray-400 font-bold uppercase">Max Range: {MAX_VEHICLE_RANGE}km</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Trip Feasibility</span>
                <span className={`text-xs font-black mt-1 p-1 rounded-md text-center border ${needsRecharge ? 'text-orange-400 border-orange-500/30 bg-orange-500/5' : 'text-green-400 border-green-500/30 bg-green-500/5'}`}>
                  {needsRecharge ? "RECHARGE REQUIRED" : "FEASIBLE DIRECT"}
                </span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Navigation Intelligence</span>
                <p className={`text-xs font-semibold leading-tight mt-1 ${needsRecharge ? 'text-orange-200' : 'text-cyan-100'}`}>
                  {!needsRecharge 
                    ? "You can reach the destination without recharging."
                    : numStops === 1
                      ? "Destination exceeds current battery range. A charging stop has been added at 100 km."
                      : `Trip requires multiple charging stops. Total stops added: ${numStops}.`
                  }
                </p>
                {isSimulated && (
                  <p className="text-[9px] text-yellow-500/80 mt-1 font-bold uppercase tracking-wider">
                    API Quota Limit Reached. Using Simulated Local Heuristics.
                  </p>
                )}
              </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="flex-1">
            <Speedometer 
               currentSpeed={evState.currentSpeed} 
               recommendedSpeed={evState.recommendedSpeed}
               consumption={evState.instantConsumptionKw}
            />
          </div>
          <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-cyan-500 shadow-lg">
             <div className="flex items-start gap-4">
                <div className="p-2 bg-cyan-500/20 rounded-xl">
                   <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Eco-Pilot Assistant</h3>
                  <p className="text-sm font-medium text-gray-200 italic leading-snug">"{efficiencyTip}"</p>
                </div>
             </div>
          </div>
        </div>
      </main>

      <footer className="h-10 flex items-center justify-between px-6 opacity-40">
         <div className="text-[9px] text-gray-500 uppercase tracking-widest font-black">
           MVP 1.0 • Deterministic Range Logic Active • Google Maps Grounding
         </div>
         <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
           Charging Threshold: Every 100 km
         </div>
      </footer>
    </div>
  );
};

export default App;
