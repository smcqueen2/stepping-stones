export type StateLabel = 'Likely Passable' | 'Caution' | 'Likely Unpassable';

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
  ageMinutes: number;
  stale: boolean;
  staleReason?: string;
}

export interface LivePayload {
  generatedAt: string;
  sourceStations: SourceStation[];
  freshness: DataFreshness;
  current: {
    riverLevelM: number;
    riverTrendMPerHour: number;
    tideLevelMAOD: number;
    tideTrendMPerHour: number;
    riskScore: number;
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

export interface ForecastHour {
  timestamp: string;
  projectedTideLevelMAOD: number;
  projectedRiverLevelM: number;
  rainfallMm: number;
  precipitationProbabilityPct: number;
  riskComponents: {
    tide: number;
    river: number;
    rain: number;
  };
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
