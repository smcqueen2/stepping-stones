export type StateLabel = 'Likely Passable' | 'Caution' | 'Likely Unpassable';
export type RiskComponents = { tide: number; river: number; rain: number };

export interface SourceStation {
  role: 'river' | 'tide';
  stationId: number;
  stationTitle: string;
  parameterId: number;
  source: 'NRW';
}

export interface DataFreshness {
  generatedAt: string;
  latestObservationAt: string;
  oldestObservationAt?: string;
  ageMinutes: number;
  stale: boolean;
  staleReason?: string;
}

export interface LivePayload {
  generatedAt: string;
  tideTiming?: TideTiming;
  recentLevels?: RecentLevels;
  sourceStations: SourceStation[];
  freshness: DataFreshness;
  current: {
    riverLevelM: number;
    riverTrendMPerHour: number;
    tideLevelMAOD: number;
    tideTrendMPerHour: number;
    riskScore: number;
    riskComponents?: RiskComponents;
    state: StateLabel;
    reason: string;
  };
  shortHorizonPrediction: {
    horizonMinutes: number;
    predictedRiverLevelM: number;
    projectedTideLevelMAOD: number;
    riskScore: number;
    state: StateLabel;
  };
}

export interface LevelPoint { time: string; value: number }
export interface RecentLevels {
  from: string;
  to: string;
  river: LevelPoint[];
  tide: LevelPoint[];
}

export interface TideTiming {
  generatedAt: string;
  source: 'Open-Meteo Marine';
  location: string;
  latitude: number;
  longitude: number;
  validFrom: string;
  validTo: string;
  events: { type: 'high' | 'low'; time: string }[];
}

export interface ForecastHour {
  timestamp: string;
  projectedTideLevelMAOD: number;
  projectedRiverLevelM: number;
  rainfallMm: number;
  precipitationProbabilityPct: number;
  riskComponents: RiskComponents;
  riskScore: number;
  state: StateLabel;
}

export interface ForecastPayload {
  generatedAt: string;
  horizonHours: number;
  summary: {
    highestRiskWindow: string;
    likelyUnpassableHours: number;
    cautionHours: number;
    likelyPassableHours: number;
  };
  hours: ForecastHour[];
}

export interface ConfigPayload {
  freshness: {
    staleAfterMinutes: number;
    severeStaleAfterMinutes: number;
  };
  stateThresholds: {
    likelyPassableMax: number;
    cautionMax: number;
  };
  weights: {
    tide: number;
    river: number;
    rain: number;
  };
  rainScaling: {
    millimetresForHighRisk: number;
  };
  messaging: {
    disclaimer: string;
    staleWarning: string;
  };
}
