import type { LocalGauge } from './types';

const stations = { ewenny: [4099, 64], downstream: [4115, 112] } as const;
export function localGaugeStatus(gauge: LocalGauge | undefined, role: keyof typeof stations, now = Date.now(), staleAfter = 120) {
  const at = Date.parse(gauge?.observedAt ?? '');
  const identity = gauge?.stationId === stations[role][0] && gauge.parameterId === stations[role][1]
    && gauge.unit === 'm' && gauge.source === 'NRW' && gauge.datum === 'unspecified';
  const valid = identity && gauge?.status === 'available' && typeof gauge.value === 'number'
    && Number.isFinite(gauge.value) && Number.isFinite(at) && at <= now + 10 * 60000;
  const ageMinutes = Math.max(0, Math.ceil((now - at) / 60000));
  return { available: Boolean(valid && ageMinutes <= staleAfter), stale: Boolean(valid && ageMinutes > staleAfter), ageMinutes };
}
