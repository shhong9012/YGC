// Optimize complete cart combinations, including changes involving three or more carts.
// The memoized search is bounded for unusually large fields; the incumbent is always valid.
export function optimizeCartHistory(groups, initial, { cost, ab, maxStates = 60000 }) {
  if (groups.length > 20) return { carts: initial, exact: false };
  const sizeOf = (cart) => cart.reduce((total, g) => total + g.size, 0);
  const sizes = [0, 0, 0, 0, 0];
  initial.forEach((cart) => sizes[sizeOf(cart)]++);
  const pinned = [...new Set(groups.map((g) => g.fixed).filter((i) => i != null))].sort((a, b) => a - b)
    .map((index) => ({ index, mask: groups.reduce((mask, g, i) => g.fixed === index ? mask | (1 << i) : mask, 0) }));
  const candidates = groups.map(() => []);
  function enumerate(start, selected, mask, size, teamA, teamB, fixed) {
    if (sizes[size] && selected.length) {
      const candidate = { mask, size, fixed, groups: selected, cost: cost([selected]) };
      groups.forEach((_, i) => { if (mask & (1 << i)) candidates[i].push(candidate); });
    }
    for (let i = start; i < groups.length; i++) {
      const g = groups[i];
      if (size + g.size > 4 || (fixed != null && g.fixed != null && fixed !== g.fixed)) continue;
      const a = teamA + (g.team === "A" ? g.size : 0), b = teamB + (g.team === "B" ? g.size : 0);
      if (ab && (a > 2 || b > 2)) continue;
      enumerate(i + 1, [...selected, g], mask | (1 << i), size + g.size, a, b, fixed ?? g.fixed);
    }
  }
  enumerate(0, [], 0, 0, 0, 0, null);
  candidates.forEach((list) => list.sort((a, b) => a.cost - b.cost || a.mask - b.mask));
  const memo = new Map();
  let visited = 0;
  const limit = Symbol("search limit");
  function solve(mask, remainingSizes, pinIndex) {
    if (mask === 0) return { cost: 0, plan: [] };
    const cacheKey = `${mask}/${remainingSizes.join(",")}/${pinIndex}`;
    if (memo.has(cacheKey)) return memo.get(cacheKey);
    if (++visited > maxStates) throw limit;
    const pin = pinned[pinIndex];
    const anchor = Math.log2((pin?.mask ?? mask) & -(pin?.mask ?? mask));
    let best = { cost: Infinity, plan: [] };
    for (const candidate of candidates[anchor]) {
      if (!remainingSizes[candidate.size] || (candidate.mask & mask) !== candidate.mask) continue;
      if (pin && ((candidate.mask & pin.mask) !== pin.mask || candidate.fixed !== pin.index)) continue;
      if (candidate.cost >= best.cost) continue;
      const nextSizes = [...remainingSizes]; nextSizes[candidate.size]--;
      const tail = solve(mask ^ candidate.mask, nextSizes, pinIndex + (pin ? 1 : 0));
      const total = candidate.cost + tail.cost;
      if (total < best.cost) best = { cost: total, plan: [{ ...candidate, cartIndex: pin?.index ?? null }, ...tail.plan] };
      if (best.cost === 0) break;
    }
    memo.set(cacheKey, best);
    return best;
  }
  try {
    const best = solve((1 << groups.length) - 1, sizes, 0);
    if (best.cost >= cost(initial) - 1e-9) return { carts: initial, exact: true };
    const carts = initial.map(() => null);
    for (const item of best.plan) if (item.cartIndex != null) carts[item.cartIndex] = item.groups;
    for (const item of best.plan) if (item.cartIndex == null) carts[carts.indexOf(null)] = item.groups;
    return { carts, exact: true };
  } catch (error) {
    if (error !== limit) throw error;
    return { carts: initial, exact: false };
  }
}
