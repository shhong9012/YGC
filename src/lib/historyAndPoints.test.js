import test from "node:test";
import assert from "node:assert/strict";
import { buildPairHistory, pairKey, summarizePairHistory } from "./pairHistory.js";
import { buildPointsMatrix } from "./pointsMatrix.js";
import { arrangeCarts } from "./cartPlacement.js";
import { optimizeCartHistory } from "./optimizeCartHistory.js";
import { getScoreOrderStats } from "./scoreOrder.js";

test("history counts unique pairs once per completed past round, including registered guests", () => {
  const rounds = [
    { id: 1, date: "2026-03-17", status: "complete", cartTeams: [[1, "2", 2, "8"], [1, 2]] },
    { id: 2, date: "2026-04-21", status: "draft_team", cartTeams: [[1, 2]] },
    { id: 3, date: "2026-04-21", status: "draft_score", cartTeams: [[1, 2]] },
    { id: 4, date: "2026-04-21", status: "complete", cartTeams: [[1, 2]] },
    { id: 5, date: "2026-05-19", status: "complete", cartTeams: [[1, 2]] },
    { id: 6, date: "2026-06-16", status: "complete", cartTeams: [[1, 2]] },
  ];
  const all = buildPairHistory(rounds);
  assert.equal(all[pairKey(1, 2)], 4);
  assert.equal(all[pairKey(1, 8)], 1);
  assert.equal(all[pairKey(2, "8")], 1);
  assert.equal(all[pairKey(2, 2)], undefined);
  const past = buildPairHistory(rounds, { excludedRoundId: "4", beforeDate: "2026-05-19" });
  assert.equal(past[pairKey(2, "1")], 1);
  assert.equal(Object.keys(past).length, 3);
});

test("history result totals count each pair once, rather than summing both members' badges", () => {
  const counts = { [pairKey(1, 2)]: 3, [pairKey(2, 3)]: 2 };
  assert.deepEqual(summarizePairHistory([[1, 2, 3], [4]], (a, b) => counts[pairKey(a, b)] || 0), { total: 5, repeatedPairs: 2 });
});

const pastCarts = [
  [[11,9,4,12],[1,8,2,10],[3,7,6,5]],
  [[4,1,3,2],[5,8,12,10],[11,9,6,7]],
  [[12,1,10,9],[11,4,7,6],[2,3,5,8]],
  [[1,5,8,9],[3,11,4,10],[7,6,12,2]],
  [[4,9,7,6],[10,3,11,12],[8,1,5,2]],
];
const counts = buildPairHistory(pastCarts.map((cartTeams, id) => ({ id, status: "complete", date: `2026-0${id + 1}-01`, cartTeams })));
const getPairCount = (a, b) => counts[pairKey(a, b)] || 0;

// Independent enumeration of all four-person partitions, used as an optimality oracle.
function minimumHistory(ids, score, valid = () => true) {
  const memo = new Map();
  function solve(remaining) {
    if (!remaining.length) return 0;
    const key = remaining.join(",");
    if (memo.has(key)) return memo.get(key);
    let best = Infinity;
    for (let i = 1; i < remaining.length; i++) for (let j = i + 1; j < remaining.length; j++) for (let k = j + 1; k < remaining.length; k++) {
      const cart = [remaining[0], remaining[i], remaining[j], remaining[k]];
      if (!valid(cart)) continue;
      best = Math.min(best, score(cart) + solve(remaining.filter((id) => !cart.includes(id))));
    }
    memo.set(key, best);
    return best;
  }
  return solve(ids);
}

test("three-cart regression: reduces history cost from the old local optimum 16 to global optimum 15", () => {
  const participants = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, average: 80 + i }));
  const score = (cart) => summarizePairHistory([cart], getPairCount).total;
  assert.equal(minimumHistory(participants.map((p) => p.id), score), 15);
  const result = arrangeCarts({ participants, mode: "pair_minimize", getPairCount });
  assert.equal(result.pairHistory.total, 15);
  assert.equal(result.historyExact, true);
  assert.match(result.notice, /과거 동반 횟수 합 15회/);
  const changedAverages = participants.map((p) => ({ ...p, average: 170 - p.id * 7 }));
  assert.deepEqual(arrangeCarts({ participants: changedAverages, mode: "pair_minimize", getPairCount }).carts, result.carts);
});

test("global history optimization retains companion constraints, manual carts and A/B limits", () => {
  const participants = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, average: 90, team: i < 4 ? "A" : "B", pairedWith: i === 1 ? 1 : null }));
  const fixedCarts = [[1, 5], [6]];
  const valid = (cart) => cart.filter((id) => id <= 4).length === 2
    && cart.includes(1) === cart.includes(2)
    && cart.includes(1) === cart.includes(5)
    && !(cart.includes(1) && cart.includes(6));
  const score = (cart) => summarizePairHistory([cart], getPairCount).total;
  const optimum = minimumHistory(participants.map((p) => p.id), score, valid);
  const result = arrangeCarts({ participants, fixedCarts, mode: "ab_team", balance: false, getPairCount });
  assert.equal(result.pairHistory.total, optimum);
  assert.equal(result.historyExact, true);
  assert.ok(result.carts[0].includes(1) && result.carts[0].includes(2) && result.carts[0].includes(5));
  assert.ok(result.carts[1].includes(6));
  result.carts.forEach((cart) => assert.ok(valid(cart)));
});

test("search limit returns the valid incumbent and does not claim an exact optimum", () => {
  const groups = Array.from({ length: 4 }, (_, i) => ({ size: 1, total: 90, fixed: null, members: [{ id: i + 1 }] }));
  const initial = [groups];
  assert.deepEqual(optimizeCartHistory(groups, initial, { cost: () => 1, ab: false, maxStates: 0 }), { carts: initial, exact: false });
});

test("points matrix aligns sparse member histories to shared chronological round columns", () => {
  const rounds = [
    { id: 3, date: "2026-05-19", status: "complete", attendees: [1, 2, 3], scores: [{ id: 1, score: 90 }] },
    { id: 2, date: "2026-04-21", status: "draft_score", attendees: [1], scores: [{ id: 1, score: 80 }] },
    { id: 1, date: "2026-03-17", status: "complete", attendees: [1], scores: [{ id: 1, score: 100 }] },
  ];
  const standings = [
    { id: 1, history: [{ roundId: 1, pts: 0, rank: 7 }, { roundId: 3, pts: 25, rank: 1 }] },
    { id: 2, history: [{ roundId: 3, pts: 18, rank: 2 }] },
    { id: 3, history: [] }, { id: 4, history: [] }, { id: 8, history: [] },
  ];
  const mm = { 1: { name: "회원1" }, 2: { name: "회원2" }, 3: { name: "회원3" }, 4: { name: "회원4" }, 8: { name: "게스트", isGuest: true } };
  const result = buildPointsMatrix(rounds, standings, mm);
  assert.deepEqual(result.columns.map((r) => r.id), [1, 3]);
  assert.equal(result.rows.length, 4);
  assert.deepEqual(result.rows[0].cells.map((c) => c.points), [0, 25]);
  assert.deepEqual(result.rows[1].cells.map((c) => c.points), [null, 18]);
  assert.equal(result.rows[1].cells[0].state, "absent");
  assert.equal(result.rows[2].cells[1].state, "pending");
  assert.deepEqual(result.rows[3].cells.map((c) => c.state), ["absent", "absent"]);
  assert.deepEqual(result.rows.map((r) => r.total), [25, 18, 0, 0]);
  assert.deepEqual(buildPointsMatrix([], [], {}), { columns: [], rows: [] });
});

test("score ordering uses each person's latest valid appearance and actual average", () => {
  const rounds = [
    { id: 30, date: "2026-03-17", status: "complete", scores: [{ id: 1, score: 80 }, { id: 2, score: 90 }, { id: "8", score: 100 }] },
    { id: 10, date: "2026-05-19", status: "complete", scores: [{ id: 1, score: 100 }, { id: 8, score: 90 }] },
    { id: 40, date: "2026-04-21", status: "complete", scores: [{ id: 1, score: 90 }, { id: 2, score: 0 }, { id: 3, score: null }] },
    { id: 50, date: "2026-06-16", status: "draft_score", scores: [{ id: 2, score: 65 }] },
    { id: 60, date: "2026-07-21", status: "complete", scores: [{ id: 1, score: 70 }] },
  ];
  const stats = getScoreOrderStats(rounds, { beforeDate: "2026-06-16" });
  assert.equal(stats[1].recentScore, 100);
  assert.equal(stats[1].scoringAverage, 90);
  assert.equal(stats[2].recentScore, 90); // Missing the latest round does not erase this member's score.
  assert.equal(stats[8].recentScore, 90);
  assert.equal(stats[8].scoringAverage, 95);
  assert.equal(stats[3], undefined);
  const editing = getScoreOrderStats(rounds, { beforeDate: "2026-06-16", excludedRoundId: "10" });
  assert.equal(editing[1].recentScore, 90);
  assert.equal(editing[1].scoringAverage, 85);
});
