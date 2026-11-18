export function rankRoundScores(scores) {
  const seen = new Set();
  const valid = [];
  for (const entry of scores || []) {
    const score = Number(entry.score);
    const id = String(entry.id);
    if (entry.id == null || !Number.isFinite(score) || score <= 0 || seen.has(id)) continue;
    seen.add(id);
    valid.push({ ...entry, score, rank: Number(entry.rank) });
  }
  valid.sort((a, b) => a.score - b.score || (a.rank || Infinity) - (b.rank || Infinity));

  // Use the recorded finish, including any tie break chosen at score entry.
  // Older rounds missing ranks use shared places for equal raw scores.
  let scoreRank = 0;
  return valid.map((entry, index) => {
    if (index === 0 || entry.score !== valid[index - 1].score) scoreRank = index + 1;
    const rank = Number.isInteger(entry.rank) && entry.rank > 0 ? entry.rank : scoreRank;
    return { ...entry, rank };
  });
}

export function buildAnnualResults(rounds, members) {
  const profiles = new Map(members.map((member) => [String(member.id), member]));
  const seasons = new Map();
  const completed = rounds.filter((round) => round.status === "complete" && /^\d{4}-\d{2}-\d{2}$/.test(round.date))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));

  for (const round of completed) {
    const scores = rankRoundScores(round.scores);
    if (scores.length === 0) continue;

    const year = Number(round.date.slice(0, 4));
    if (!seasons.has(year)) seasons.set(year, { year, roundCount: 0, players: new Map() });
    const season = seasons.get(year);
    season.roundCount++;

    for (const entry of scores) {
      const id = String(entry.id);
      const profile = profiles.get(id);
      if (!season.players.has(id)) {
        season.players.set(id, {
          id, name: profile?.name || "회원 #" + id, isGuest: Boolean(profile?.isGuest), results: [],
        });
      }
      season.players.get(id).results.push({
        roundId: round.id, date: round.date, course: round.course, score: entry.score, rank: entry.rank,
      });
    }
  }

  return Array.from(seasons.values(), ({ year, roundCount, players }) => {
    const rows = Array.from(players.values(), (player) => {
      const results = player.results;
      const avgScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
      const avgRank = results.reduce((sum, result) => sum + result.rank, 0) / results.length;
      return { ...player, avgScore, avgRank };
    });
    rows.sort((a, b) => a.avgScore - b.avgScore || a.avgRank - b.avgRank || a.name.localeCompare(b.name, "ko"));
    return { year, roundCount, players: rows };
  });
}
