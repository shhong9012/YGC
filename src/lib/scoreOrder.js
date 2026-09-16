// A member's latest score comes from their latest appearance, not just the latest event.
export function getScoreOrderStats(rounds, { excludedRoundId = null, beforeDate = null } = {}) {
  const stats = {};
  const completed = rounds.filter((round) => round.status === "complete"
    && (excludedRoundId == null || String(round.id) !== String(excludedRoundId))
    && (!beforeDate || (round.date && round.date < beforeDate)))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
  for (const round of completed) {
    const seen = new Set();
    for (const entry of round.scores || []) {
      const score = Number(entry.score), id = String(entry.id);
      if (!Number.isFinite(score) || score <= 0 || seen.has(id)) continue;
      seen.add(id);
      if (!stats[id]) stats[id] = { recentScore: score, recentDate: round.date, total: 0, count: 0 };
      stats[id].total += score;
      stats[id].count++;
    }
  }
  for (const item of Object.values(stats)) item.scoringAverage = item.total / item.count;
  return stats;
}

export function rankingValue(person, mode) {
  const value = mode === "recent_score" ? person.recentScore : person.scoringAverage;
  return value != null && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : Infinity;
}

export function compareByScore(a, b, mode) {
  const aScore = rankingValue(a, mode), bScore = rankingValue(b, mode);
  if (aScore !== bScore) return aScore - bScore;
  return String(a.id).localeCompare(String(b.id), "ko", { numeric: true });
}
