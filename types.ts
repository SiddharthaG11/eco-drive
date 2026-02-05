
export interface ChargingStop {
  id: string;
  kmAt: number;
  label: string;
}

export interface RouteOption {
  id: string;
  name: string;
  distanceKm: number;
  durationMin: number;
  elevationGainM: number;
  elevationLossM: number;
  trafficLevel: 'Low' | 'Moderate' | 'High';
  estimatedBatteryConsumption: number; // in percentage
  isOptimal: boolean;
  reasoning: string;
  mapUri?: string;
  chargingStops?: ChargingStop[]; // New field for MVP range logic
}

export interface EVState {
  currentSpeed: number;
  recommendedSpeed: number;
  batteryPercent: number;
  rangeKm: number;
  maxRangeKm: number; // Added for range constraint logic
  efficiencyWhKm: number;
  instantConsumptionKw: number;
}

export interface NavigationTarget {
  destination: string;
  distanceKm: number;
  eta: string;
}
