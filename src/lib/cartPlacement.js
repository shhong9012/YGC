import { optimizeCartHistory } from "./optimizeCartHistory.js";
import { summarizePairHistory } from "./pairHistory.js";

const CAPACITY = 4;
const key = (id) => String(id);
const sum = (values) => values.reduce((total, value) => total + value, 0);

// A companion group is indivisible throughout placement and optimization.
function makeGroups(participants) {
  const people = new Map();
  for (const person of participants) {
    if (people.has(key(person.id))) throw new Error("참석자가 중복되어 있습니다. 참석자 목록을 확인해 주세요.");
    people.set(key(person.id), person);
  }
  const parent = new Map([...people.keys()].map((id) => [id, id]));
  const root = (id) => parent.get(id) === id ? id : root(parent.get(id));
  for (const person of participants) {
    if (person.pairedWith == null) continue;
    const partner = key(person.pairedWith);
    if (!people.has(partner)) throw new Error(`${person.name || person.id}님의 동반자가 참석자에 없습니다.`);
    parent.set(root(key(person.id)), root(partner));
  }
  const groups = new Map();
  for (const person of participants) {
    const id = root(key(person.id));
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(person);
  }
  return [...groups.values()].map((members) => {
    if (members.length > CAPACITY) {
      throw new Error(`${members.map((p) => p.name || p.id).join("·")} 동반 묶음은 ${members.length}명입니다. 카트 정원은 4명이므로 동반 설정을 나눠 주세요.`);
    }
    return { members, size: members.length, total: sum(members.map((p) => Number(p.average) || 100)) };
  });
}

// Preserve manual team choices; count companions when seeding new participants.
export function seedTeams(participants, previous = {}) {
  const groups = makeGroups(participants);
  const result = {};
  let countA = 0, countB = 0, sumA = 0, sumB = 0;
  const missing = [];
  for (const group of groups) {
    const leader = group.members.find((p) => p.pairedWith == null) || group.members[0];
    group.leader = key(leader.id);
    const team = previous[group.leader];
    if (team !== "A" && team !== "B") { missing.push(group); continue; }
    result[group.leader] = team;
    if (team === "A") { countA += group.size; sumA += group.total; }
    else { countB += group.size; sumB += group.total; }
  }
  let states = new Map([["0/0", { count: 0, total: 0, assignments: {} }]]);
  let processedCount = 0, processedTotal = 0;
  const gap = (aCount, aTotal, bCount, bTotal) => Math.abs((aCount ? aTotal / aCount : 0) - (bCount ? bTotal / bCount : 0));
  for (const group of missing) {
    processedCount += group.size;
    processedTotal += group.total;
    const next = new Map();
    for (const state of states.values()) {
      for (const team of ["A", "B"]) {
        const n = state.count + (team === "A" ? group.size : 0);
        const total = state.total + (team === "A" ? group.total : 0);
        const cost = gap(countA + n, sumA + total, countB + processedCount - n, sumB + processedTotal - total);
        // Keep distinct score totals: an early average tie can lead to a poor final split.
        const stateKey = `${n}/${Math.round(total * 10)}`;
        if (!next.has(stateKey)) {
          next.set(stateKey, { count: n, total, cost, assignments: { ...state.assignments, [group.leader]: team } });
        }
      }
    }
    states = next;
  }
  const best = [...states.values()].sort((a, b) =>
    Math.abs(countA + 2 * a.count - countB - processedCount) - Math.abs(countA + 2 * b.count - countB - processedCount)
    || (a.cost || 0) - (b.cost || 0))[0];
  return { ...result, ...best?.assignments };
}

export function validateCarts(participants, carts, { requireAll = false } = {}) {
  const people = new Set(participants.map((p) => key(p.id)));
  const placed = new Set();
  for (const cart of carts) {
    if (cart.length > CAPACITY) throw new Error("카트 정원은 4명입니다. 초과 인원을 다른 카트로 옮겨 주세요.");
    for (const id of cart) {
      if (!people.has(key(id))) throw new Error("참석자가 아닌 인원이 카트에 있습니다. 다시 편성해 주세요.");
      if (placed.has(key(id))) throw new Error("같은 참석자가 여러 카트에 배치되어 있습니다. 다시 편성해 주세요.");
      placed.add(key(id));
    }
  }
  if (requireAll && placed.size !== people.size) throw new Error("미배치 인원이 있습니다. 카트 배치를 완료해 주세요.");
}

// Try the most even occupancy first (e.g. 10 people: 4/3/3).
function capacityPatterns(total, count, max = CAPACITY) {
  if (count === 0) return total === 0 ? [[]] : [];
  const patterns = [];
  for (let size = Math.min(max, total - count + 1); size >= 1; size--) {
    if (total - size > size * (count - 1)) continue;
    for (const tail of capacityPatterns(total - size, count - 1, size)) patterns.push([size, ...tail]);
  }
  return patterns.sort((a, b) => sum(a.map((n) => n * n)) - sum(b.map((n) => n * n)));
}

function* capacityOrders(pattern, pinnedSizes, prefix = []) {
  if (!pattern.length) { yield prefix; return; }
  const used = new Set();
  for (let i = 0; i < pattern.length; i++) {
    const size = pattern[i];
    if (used.has(size) || size < pinnedSizes[prefix.length]) continue;
    used.add(size);
    yield* capacityOrders(pattern.filter((_, j) => i !== j), pinnedSizes, [...prefix, size]);
  }
}

export function arrangeCarts({ participants, mode = "cart_avg", fixedCarts = [], getPairCount = () => 0, balance = true, history = true }) {
  if (!participants.length) return { carts: [], notice: "" };
  const groups = makeGroups(participants);
  validateCarts(participants, fixedCarts);
  const ab = mode === "ab_team";
  for (const group of groups) {
    if (!ab) continue;
    const teams = new Set(group.members.map((p) => p.team));
    if (teams.size !== 1 || !["A", "B"].includes([...teams][0])) throw new Error("A/B 팀을 지정하고 동반자끼리 같은 팀으로 설정해 주세요.");
    group.team = [...teams][0];
    if (group.size > 2) throw new Error("A/B 팀전은 카트마다 팀별 최대 2명입니다. 3명 이상 동반 묶음은 동반 설정을 나누거나 일반 자동 편성을 이용해 주세요.");
  }
  const minimum = Math.ceil(participants.length / CAPACITY);
  if (ab) {
    const a = sum(groups.filter((g) => g.team === "A").map((g) => g.size));
    const b = participants.length - a;
    if (!a || !b || a > minimum * 2 || b > minimum * 2) {
      throw new Error(`현재 A팀 ${a}명·B팀 ${b}명입니다. ${minimum}개 카트에 팀별 최대 2명씩 배치할 수 있도록 A/B 인원을 조정해 주세요.`);
    }
  }
  const fixedIndex = new Map();
  fixedCarts.forEach((cart, ci) => cart.forEach((id) => fixedIndex.set(key(id), ci)));
  for (const group of groups) {
    const locations = new Set(group.members.filter((p) => fixedIndex.has(key(p.id))).map((p) => fixedIndex.get(key(p.id))));
    if (locations.size > 1) throw new Error("동반자가 서로 다른 카트에 수동 배치되어 있습니다. 같은 카트로 옮긴 뒤 자동 배치해 주세요.");
    group.fixed = locations.size ? [...locations][0] : null;
  }
  const pinnedCount = Math.max(0, ...groups.map((g) => g.fixed == null ? 0 : g.fixed + 1));
  const pinned = Array.from({ length: pinnedCount }, (_, i) => groups.filter((g) => g.fixed === i));
  const sizeOf = (cart) => sum(cart.map((g) => g.size));
  const teamSize = (cart, team) => sum(cart.filter((g) => g.team === team).map((g) => g.size));
  if (pinned.some((cart) => sizeOf(cart) > CAPACITY)) throw new Error("수동 배치한 카트에 동반자까지 넣으면 4명을 초과합니다. 자리를 비우거나 동반 묶음을 다른 카트로 옮겨 주세요.");
  if (ab && pinned.some((cart) => teamSize(cart, "A") > 2 || teamSize(cart, "B") > 2)) throw new Error("수동 배치에서 카트별 A/B 인원을 2명 이하로 맞춰 주세요.");

  const useBalance = mode !== "pair_minimize" && (!ab || balance);
  const useHistory = mode === "pair_minimize" || (ab && history);
  const globalAverage = sum(groups.map((g) => g.total)) / participants.length;
  const peopleOf = (cart) => cart.flatMap((g) => g.members);
  const cost = (carts) => sum(carts.map((cart) => {
    const people = peopleOf(cart);
    if (!people.length) return 0;
    let value = useBalance ? ((sum(cart.map((g) => g.total)) / people.length - globalAverage) / 10) ** 2 : 0;
    if (useHistory) {
      for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) value += getPairCount(people[i].id, people[j].id);
    }
    return value;
  }));
  const free = groups.filter((g) => g.fixed == null).sort((a, b) => b.size - a.size || (useBalance ? b.total / b.size - a.total / a.size : 0));
  let solution;
  // Exact feasibility search with memoized capacity states. Soft preferences never bypass limits.
  for (let count = Math.max(minimum, pinnedCount); count <= Math.max(groups.length, pinnedCount); count++) {
    if (ab && count > minimum) break;
    const base = Array.from({ length: count }, (_, i) => [...(pinned[i] || [])]);
    for (const pattern of capacityPatterns(participants.length, count)) {
      const orders = pinnedCount ? capacityOrders(pattern, base.map(sizeOf)) : [pattern];
      for (const capacities of orders) {
        const carts = base.map((cart) => [...cart]);
        const failed = new Set();
        const signature = (i) => `${capacities[i] - sizeOf(carts[i])}/${teamSize(carts[i], "A")}/${teamSize(carts[i], "B")}`;
        const search = (index) => {
          if (index === free.length) return true;
          const state = `${index}:${carts.map((_, i) => signature(i)).sort().join("|")}`;
          if (failed.has(state)) return false;
          const group = free[index];
          const options = [];
          carts.forEach((cart, i) => {
            if (sizeOf(cart) + group.size > capacities[i] || (ab && teamSize(cart, group.team) + group.size > 2)) return;
            cart.push(group);
            options.push({ i, score: cost(carts) });
            cart.pop();
          });
          options.sort((a, b) => a.score - b.score || a.i - b.i);
          const tried = new Set();
          for (const { i } of options) {
            const shape = signature(i);
            if (tried.has(shape)) continue;
            tried.add(shape);
            carts[i].push(group);
            if (search(index + 1)) return true;
            carts[i].pop();
          }
          failed.add(state);
          return false;
        };
        if (search(0)) { solution = carts; break; }
      }
      if (solution) break;
    }
    if (solution) break;
  }
  if (!solution) throw new Error("현재 동반 설정과 수동 배치를 유지하며 편성할 수 없습니다. 동반 설정이나 수동 배치를 조정해 주세요.");

  // Improve averages/history by swapping equal-size subsets of free groups.
  // Swapping a pair against two singles is allowed; splitting a companion group is not.
  const subsets = (cart) => {
    const movable = cart.filter((g) => g.fixed == null);
    let list = [[]];
    for (const group of movable) list = [...list, ...list.map((set) => [...set, group])];
    return list.filter((set) => set.length);
  };
  for (let pass = 0; pass < 40; pass++) {
    let bestCost = cost(solution), best = null;
    for (let i = 0; i < solution.length; i++) for (let j = i + 1; j < solution.length; j++) {
      for (const left of subsets(solution[i])) for (const right of subsets(solution[j])) {
        if (sizeOf(left) !== sizeOf(right)) continue;
        const a = [...solution[i].filter((g) => !left.includes(g)), ...right];
        const b = [...solution[j].filter((g) => !right.includes(g)), ...left];
        if (ab && [a, b].some((cart) => teamSize(cart, "A") > 2 || teamSize(cart, "B") > 2)) continue;
        const candidate = solution.map((cart, ci) => ci === i ? a : ci === j ? b : cart);
        const score = cost(candidate);
        if (score < bestCost - 1e-9) { bestCost = score; best = candidate; }
      }
    }
    if (!best) break;
    solution = best;
  }
  let historyExact = false;
  if (useHistory) {
    const optimized = optimizeCartHistory(groups, solution, { cost, ab });
    solution = optimized.carts;
    historyExact = optimized.exact;
  }
  const carts = solution.map((cart, ci) => {
    let people = peopleOf(cart);
    if (ab) people.sort((a, b) => a.team.localeCompare(b.team));
    else if (mode === "seat_balance" && people.length === 4) {
      const [a, b, c, d] = people;
      const options = [[a, b, c, d], [a, c, b, d], [a, d, b, c]].filter((order) =>
        cart.filter((g) => g.size === 2).every((g) => Math.floor(order.indexOf(g.members[0]) / 2) === Math.floor(order.indexOf(g.members[1]) / 2)));
      const seatGap = (order) => Math.abs((Number(order[0].average) || 100) + (Number(order[1].average) || 100) - (Number(order[2].average) || 100) - (Number(order[3].average) || 100));
      options.sort((a, b) => seatGap(a) - seatGap(b));
      people = options[0] || people;
    }
    // Seat-specific modes retain each person's cart, then order A/B or front/back seats.
    if (ab || mode === "seat_balance") return people.map((p) => p.id);
    // Other modes also preserve existing manual seat positions.
    const fixed = fixedCarts[ci] || [];
    return [...fixed, ...people.filter((p) => !fixed.some((id) => key(id) === key(p.id))).map((p) => p.id)];
  });
  validateCarts(participants, carts, { requireAll: true });
  const nonempty = carts.filter((cart) => cart.length);
  const pairHistory = useHistory ? summarizePairHistory(carts, getPairCount) : null;
  return {
    carts,
    pairHistory,
    historyExact,
    notice: `${nonempty.length}개 카트 · ${nonempty.map((cart) => `${cart.length}명`).join(" / ")}${nonempty.length > minimum ? " — 동반 묶음과 수동 배치를 유지하기 위해 카트를 추가했습니다." : ""}${pairHistory ? ` · 과거 동반 횟수 합 ${pairHistory.total}회 (${pairHistory.repeatedPairs}쌍)` : ""}`,
  };
}
