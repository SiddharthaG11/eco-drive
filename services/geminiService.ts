
import { GoogleGenAI, Type } from "@google/genai";
import { RouteOption } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface EnhancedRouteOption extends RouteOption {
  isSimulated?: boolean;
}

// Local lookup for common destinations to "improvise" distance when API fails
const LOCAL_DISTANCE_ESTIMATOR: Record<string, number> = {
  'chennai': 32,
  'marina': 35,
  'tambaram': 12,
  'guindy': 24,
  'pondy': 120,
  'pondicherry': 120,
  'bangalore': 330,
  'bengaluru': 330,
  'coimbatore': 480,
  'madurai': 430,
  'vellore': 120,
  'vit vellore': 125,
  'airport': 18,
  'chennai airport': 18,
  'thiruvanmiyur': 28,
  'adyar': 30,
};

function estimateDistance(destination: string): number {
  const normalized = destination.toLowerCase().trim();
  // Check if it's in our local map
  for (const [key, value] of Object.entries(LOCAL_DISTANCE_ESTIMATOR)) {
    if (normalized.includes(key)) return value;
  }
  
  // Generic estimation based on string length and random factor for variety
  // This "improvises" a plausible distance when we have no other data
  const base = 15 + (destination.length * 2);
  const jitter = Math.floor(Math.random() * 10);
  return base + jitter;
}

export async function optimizeRoute(
  destination: string, 
  currentBattery: number, 
  userLocation?: { latitude: number; longitude: number }
): Promise<EnhancedRouteOption[]> {
  try {
    const prompt = `You are an expert EV routing engine. 
    TASK: Find 3 potential routes to "${destination}" from the start point 'VIT Chennai' (coordinates: 12.8406, 80.1534).
    
    1. Use Google Maps to get real-time routing and traffic.
    2. IMPORTANT: Use your internal knowledge of terrain to ESTIMATE 'elevationGainM', 'elevationLossM', and 'estimatedBatteryConsumption'.
    3. Ensure one route is "Eco-Optimal" (best for range), one is "Fastest", and one is "Balanced".

    OUTPUT FORMAT: Return ONLY a raw JSON array. Do not apologize. 
    
    Schema:
    [
      {
        "id": "1",
        "name": "Route Name",
        "distanceKm": number,
        "durationMin": number,
        "elevationGainM": number,
        "elevationLossM": number,
        "trafficLevel": "Low" | "Moderate" | "High",
        "estimatedBatteryConsumption": number,
        "isOptimal": boolean,
        "reasoning": "Explain why this route is good for an EV"
      }
    ]

    Current Vehicle Battery: ${currentBattery}%`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: 12.8406,
              longitude: 80.1534
            }
          }
        },
      }
    });

    let text = "";
    if (response.candidates?.[0]?.content?.parts) {
      text = response.candidates[0].content.parts
        .map(part => part.text || "")
        .join("")
        .trim();
    }

    if (!text || text.toLowerCase().includes("i am sorry") || text.toLowerCase().includes("cannot fulfill")) {
      throw new Error("Refusal or empty response");
    }

    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : text.trim();

    const routes: EnhancedRouteOption[] = JSON.parse(jsonString);
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && Array.isArray(routes)) {
      routes.forEach((route) => {
        const mapsChunk = groundingChunks.find(chunk => chunk.maps?.uri);
        route.mapUri = mapsChunk?.maps?.uri || `https://www.google.com/maps/search/${encodeURIComponent(destination)}`;
        route.isSimulated = false;
      });
    }

    return routes;

  } catch (error: any) {
    const isQuotaError = error?.message?.includes("quota") || error?.message?.includes("429");
    console.warn(isQuotaError ? "API Quota Exceeded. Using Improvised Distance Estimation." : "Gemini Error:", error);
    
    // Improvised distance calculation from VIT Chennai
    const estimatedDist = estimateDistance(destination);
    const estimatedTime = Math.round(estimatedDist * 1.8); // Simple 1.8 min/km avg
    const baseConsumption = Math.min(currentBattery - 5, (estimatedDist / 100) * 20); 

    return [
      {
        id: "1",
        name: "Improvised Eco-Optimal",
        distanceKm: estimatedDist,
        durationMin: estimatedTime,
        elevationGainM: 20,
        elevationLossM: 10,
        trafficLevel: 'Low',
        estimatedBatteryConsumption: Number((baseConsumption * 0.9).toFixed(1)),
        isOptimal: true,
        isSimulated: true,
        reasoning: `SIMULATED: Estimated ${estimatedDist}km distance from VIT Chennai based on destination heuristics.`,
        mapUri: `https://www.google.com/maps/search/${encodeURIComponent(destination)}`
      },
      {
        id: "2",
        name: "Improvised Fast-Path",
        distanceKm: Number((estimatedDist * 1.1).toFixed(1)),
        durationMin: Math.round(estimatedTime * 0.8),
        elevationGainM: 40,
        elevationLossM: 30,
        trafficLevel: 'Moderate',
        estimatedBatteryConsumption: Number((baseConsumption * 1.3).toFixed(1)),
        isOptimal: false,
        isSimulated: true,
        reasoning: "SIMULATED: Highway estimation with moderate traffic modeling.",
        mapUri: `https://www.google.com/maps/search/${encodeURIComponent(destination)}`
      },
      {
        id: "3",
        name: "Improvised Balanced",
        distanceKm: Number((estimatedDist * 1.05).toFixed(1)),
        durationMin: Math.round(estimatedTime * 0.95),
        elevationGainM: 30,
        elevationLossM: 20,
        trafficLevel: 'Moderate',
        estimatedBatteryConsumption: Number(baseConsumption.toFixed(1)),
        isOptimal: false,
        isSimulated: true,
        reasoning: "SIMULATED: Balanced route considering distance and traffic standard deviation.",
        mapUri: `https://www.google.com/maps/search/${encodeURIComponent(destination)}`
      }
    ];
  }
}

export async function getEfficiencyTip(speed: number, battery: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Status: Stationary vehicle, ${battery}% battery. Short EV tip (max 8 words).`,
    });
    return response.text.trim().replace(/^"|"$/g, '');
  } catch (error) {
    return "Check tire pressure for optimal range.";
  }
}
