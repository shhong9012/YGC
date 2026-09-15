export function buildPointsMatrix(rounds, standings, membersById) {
  const columns = rounds.filter((r) => r.status === "complete" && r.scores?.length)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const rows = standings.filter((member) => membersById[member.id] && !membersById[member.id].isGuest).map((member) => {
    const byRound = new Map(member.history.map((entry) => [String(entry.roundId), entry]));
    const cells = columns.map((round) => {
      const result = byRound.get(String(round.id));
      const attended = result != null || round.attendees?.some((id) => String(id) === String(member.id));
      return { roundId: round.id, points: result?.pts ?? null, rank: result?.rank ?? null, state: result ? "scored" : attended ? "pending" : "absent" };
    });
    return { id: member.id, name: membersById[member.id].name, cells, total: cells.reduce((total, cell) => total + (cell.points || 0), 0) };
  });
  return { columns, rows };
}
