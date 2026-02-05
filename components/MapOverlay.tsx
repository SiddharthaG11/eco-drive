
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RouteOption } from '../types';

interface Props {
  routes: RouteOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  destinationName: string;
}

const VIT_CHENNAI_COORDS: [number, number] = [12.8406, 80.1534];

const MapOverlay: React.FC<Props> = ({ routes, selectedId, onSelect, destinationName }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayersRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [roadGeometry, setRoadGeometry] = useState<Record<string, [number, number][]>>({});

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    mapRef.current = L.map(mapContainerRef.current, {
      center: VIT_CHENNAI_COORDS,
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(mapRef.current);

    routeLayersRef.current = L.layerGroup().addTo(mapRef.current);
    markersLayerRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fetch real road geometry from OSRM
  useEffect(() => {
    const fetchRoadPaths = async () => {
      if (!destinationName) return;

      try {
        // 1. Geocode the destination
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinationName)}&limit=1`);
        const geoData = await geoRes.json();
        
        if (!geoData || geoData.length === 0) return;
        
        const destLat = parseFloat(geoData[0].lat);
        const destLng = parseFloat(geoData[0].lon);

        // 2. Fetch Route from OSRM
        // We simulate 3 routes by slightly shifting mid-points if possible, 
        // but OSRM gives us the primary road path.
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${VIT_CHENNAI_COORDS[1]},${VIT_CHENNAI_COORDS[0]};${destLng},${destLat}?overview=full&geometries=geojson`;
        const routeRes = await fetch(osrmUrl);
        const routeData = await routeRes.json();

        if (routeData.code === 'Ok' && routeData.routes.length > 0) {
          const coords = routeData.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
          
          // Create variations for the 3 route options (simulated deviations for UI)
          const newGeoms: Record<string, [number, number][]> = {
            '1': coords, // Primary
            '2': coords.map(c => [c[0] + 0.001, c[1] + 0.001] as [number, number]), // Offset
            '3': coords.map(c => [c[0] - 0.001, c[1] - 0.001] as [number, number])  // Offset
          };
          setRoadGeometry(newGeoms);
        }
      } catch (err) {
        console.error("Routing error:", err);
      }
    };

    fetchRoadPaths();
  }, [destinationName]);

  useEffect(() => {
    if (!mapRef.current || !routeLayersRef.current || !markersLayerRef.current) return;

    routeLayersRef.current.clearLayers();
    markersLayerRef.current.clearLayers();

    const selectedRoute = routes.find(r => r.id === selectedId);
    const activeCoords = roadGeometry[selectedId] || roadGeometry['1'];

    // If no road geometry yet, don't draw
    if (!activeCoords || activeCoords.length === 0) return;

    const destCoords = activeCoords[activeCoords.length - 1];

    // Add Start Marker
    L.circleMarker(VIT_CHENNAI_COORDS, {
      radius: 8,
      fillColor: '#06b6d4',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(markersLayerRef.current).bindPopup('Start: VIT Chennai');

    // Add Destination Marker
    L.marker(destCoords, {
      icon: L.divIcon({
        className: 'dest-marker',
        html: `<div style="background-color: #22c55e; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #22c55e;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).addTo(markersLayerRef.current).bindPopup(`Destination: ${destinationName}`);

    // Draw all routes (faint)
    routes.forEach(route => {
      const isSelected = route.id === selectedId;
      const coords = roadGeometry[route.id] || activeCoords;
      
      const polyline = L.polyline(coords, {
        color: isSelected ? '#06b6d4' : '#333',
        weight: isSelected ? 6 : 3,
        opacity: isSelected ? 0.9 : 0.3,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayersRef.current!);

      if (isSelected) {
        // Add Charging Stops Markers along the ACTUAL road path
        route.chargingStops?.forEach((stop) => {
          // Find approximate position on the coordinate array
          const stopRatio = Math.min(0.95, stop.kmAt / route.distanceKm);
          const stopIdx = Math.floor(stopRatio * (coords.length - 1));
          const stopCoords = coords[stopIdx];

          if (stopCoords) {
            L.marker(stopCoords, {
              icon: L.divIcon({
                className: 'charging-icon',
                html: `
                  <div style="background-color: #f97316; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(249,115,22,0.8); border: 2px solid white;">
                    <svg style="width: 16px; height: 16px; color: white;" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              })
            }).addTo(markersLayerRef.current!).bindPopup(stop.label);
          }
        });

        // Fit map to bounds of the selected road route
        mapRef.current?.fitBounds(polyline.getBounds(), { padding: [60, 60] });
      }
    });

  }, [routes, selectedId, destinationName, roadGeometry]);

  return (
    <div className="relative w-full h-full glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      
      {/* Route Selection Overlays */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-[1000]">
        {routes.map(route => (
          <button
            key={route.id}
            onClick={() => onSelect(route.id)}
            className={`px-4 py-3 rounded-xl transition-all flex items-center gap-4 text-left ${
              selectedId === route.id ? 'bg-cyan-500/30 border border-cyan-500/50 backdrop-blur-md shadow-lg scale-105' : 'bg-black/80 border border-white/10 hover:bg-black/90'
            }`}
          >
            <div className="flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-0.5">{route.name}</div>
              <div className="text-xs font-bold text-white">
                {route.distanceKm}km • {route.durationMin}m
              </div>
            </div>
            {route.distanceKm > 100 && (
              <div className="bg-orange-500/20 text-orange-400 p-1 rounded-md border border-orange-500/30">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Map Legend */}
      <div className="absolute top-6 right-6 p-3 bg-black/80 border border-white/10 rounded-xl backdrop-blur-md z-[1000] flex flex-col gap-2">
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_5px_#06b6d4]"></div>
            <span className="text-[9px] font-bold text-gray-300 uppercase">VIT Chennai (Origin)</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div>
            <span className="text-[9px] font-bold text-gray-300 uppercase">Road Destination</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-500 shadow-[0_0_5px_#f97316]"></div>
            <span className="text-[9px] font-bold text-gray-300 uppercase">EV Charge Point</span>
         </div>
         <div className="mt-1 pt-1 border-t border-white/10">
            <span className="text-[8px] text-gray-500 uppercase font-black">Powered by OSRM Road Logic</span>
         </div>
      </div>
    </div>
  );
};

export default MapOverlay;
