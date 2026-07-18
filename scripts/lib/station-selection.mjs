export function pickPreferredTideStation(candidates, staleAfterMinutes, nowIso = new Date().toISOString()) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('No tide station candidates provided');
  }

  const now = Date.parse(nowIso);

  const ranked = candidates
    .filter((c) => c?.latestTime)
    .map((candidate) => {
      const ageMinutes = (now - Date.parse(candidate.latestTime)) / 60000;
      return {
        ...candidate,
        ageMinutes,
        isFresh: Number.isFinite(ageMinutes) && ageMinutes <= staleAfterMinutes,
      };
    })
    .sort((a, b) => a.priority - b.priority || a.ageMinutes - b.ageMinutes);

  if (!ranked.length) {
    throw new Error('No tide candidates with valid latestTime');
  }

  const fresh = ranked.find((station) => station.isFresh);

  if (fresh) {
    return {
      station: fresh,
      usedFallback: fresh.priority !== 0,
      stale: false,
      reason:
        fresh.priority === 0
          ? 'Primary tide station current'
          : `Primary station stale; fallback station ${fresh.stationId} selected`,
    };
  }

  const freshest = ranked.slice().sort((a, b) => a.ageMinutes - b.ageMinutes)[0];

  return {
    station: freshest,
    usedFallback: freshest.priority !== 0,
    stale: true,
    reason: 'All tide candidates stale; freshest available station selected',
  };
}
