export const pairKey = (a, b) => JSON.stringify([String(a), String(b)].sort());

// Count each pair once per completed round, regardless of duplicate rows or ID types.
export function buildPairHistory(rounds, { excludedRoundId = null, beforeDate = null } = {}) {
  const counts = {};
  for (const round of rounds) {
    if (round.status !== "complete") continue;
    if (excludedRoundId != null && String(round.id) === String(excludedRoundId)) continue;
    if (beforeDate && (!round.date || round.date >= beforeDate)) continue;
    const seen = new Set();
    for (const cart of round.cartTeams || []) {
      const ids = [...new Set(cart.filter((id) => id != null && String(id) !== "").map(String))];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) seen.add(pairKey(ids[i], ids[j]));
    }
    for (const pair of seen) counts[pair] = (counts[pair] || 0) + 1;
  }
  return counts;
}

export function summarizePairHistory(carts, getPairCount) {
  let total = 0, repeatedPairs = 0;
  for (const cart of carts) {
    for (let i = 0; i < cart.length; i++) for (let j = i + 1; j < cart.length; j++) {
      const count = getPairCount(cart[i], cart[j]);
      total += count;
      if (count > 0) repeatedPairs++;
    }
  }
  return { total, repeatedPairs };
}
