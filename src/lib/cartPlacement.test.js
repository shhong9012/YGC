import test from "node:test";
import assert from "node:assert/strict";
import { arrangeCarts, seedTeams, validateCarts } from "./cartPlacement.js";

const person = (id, average = 100, pairedWith = null, team) => ({ id, name: `참석자${id}`, average, pairedWith, team });
const key = String;
const normalModes = ["cart_avg", "seat_balance", "pair_minimize"];
function check(participants, result, ab = false) {
  const { carts } = result;
  assert.deepEqual(carts.flat().map(key).sort(), participants.map((p) => key(p.id)).sort());
  assert.equal(new Set(carts.flat().map(key)).size, participants.length);
  for (const cart of carts) {
    assert.ok(cart.length <= 4, `Overfull cart: ${cart}`);
    if (ab) {
      const teams = cart.map((id) => participants.find((p) => key(p.id) === key(id)).team);
      assert.ok(teams.filter((t) => t === "A").length <= 2);
      assert.ok(teams.filter((t) => t === "B").length <= 2);
      if (cart.length === 4) assert.deepEqual(teams, ["A", "A", "B", "B"]);
    }
  }
  for (const p of participants) {
    if (p.pairedWith == null) continue;
    assert.equal(carts.findIndex((c) => c.some((id) => key(id) === key(p.id))), carts.findIndex((c) => c.some((id) => key(id) === key(p.pairedWith))));
  }
}

test("regression: late high-average companion pair produces 4/4, never 5/3", () => {
  const participants = [...Array.from({ length: 7 }, (_, i) => person(i + 1, 70 + i * 6)), person("guest_1", 125, 7)];
  const before = structuredClone(participants);
  for (const mode of normalModes) {
    const result = arrangeCarts({ participants, mode });
    check(participants, result);
    assert.deepEqual(result.carts.map((c) => c.length), [4, 4]);
  }
  assert.deepEqual(participants, before);
});

test("all regular modes balance occupancy for 4 through 20 attendees", () => {
  for (let count = 4; count <= 20; count++) {
    const participants = Array.from({ length: count }, (_, i) => person(i + 1, 70 + (i * 7) % 45));
    for (const mode of normalModes) {
      const result = arrangeCarts({ participants, mode });
      check(participants, result);
      assert.equal(result.carts.length, Math.ceil(count / 4));
      const sizes = result.carts.map((c) => c.length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    }
  }
});

function grouped(sizes) {
  let id = 1;
  return sizes.flatMap((size) => {
    const member = id++;
    return [person(member, 70 + (member * 11) % 40), ...Array.from({ length: size - 1 }, () => person(`guest_${id++}`, 90, member))];
  });
}

test("indivisible groups fit without greedy dead ends, or add the necessary cart", () => {
  for (const sizes of [[3, 3, 2], [2, 2, 2, 2, 2], [3, 3, 3, 1, 1, 1], [4, 3, 2, 1], [4, 4, 4], [2, 3, 2, 1]]) {
    const participants = grouped(sizes);
    for (const mode of normalModes) check(participants, arrangeCarts({ participants, mode }));
  }
  const result = arrangeCarts({ participants: grouped([3, 3, 2]) });
  assert.deepEqual(result.carts.map((c) => c.length), [3, 3, 2]);
  assert.match(result.notice, /카트를 추가/);
  assert.throws(() => arrangeCarts({ participants: grouped([5, 1, 1, 1]) }), /동반 묶음은 5명/);
});

test("seat balance preserves both companion pairs in their own two-seat halves", () => {
  const participants = [person(1, 70), person("guest_a", 80, 1), person(2, 110), person("guest_b", 120, 2)];
  const result = arrangeCarts({ participants, mode: "seat_balance" });
  check(participants, result);
  const cart = result.carts[0];
  assert.equal(Math.floor(cart.indexOf(1) / 2), Math.floor(cart.indexOf("guest_a") / 2));
  assert.equal(Math.floor(cart.indexOf(2) / 2), Math.floor(cart.indexOf("guest_b") / 2));
});

test("cart average mode balances real attendee averages, including guests", () => {
  const participants = [70, 80, 90, 100, 110, 120, 130, 140].map((avg, i) => person(i + 1, avg));
  const result = arrangeCarts({ participants });
  const means = result.carts.map((c) => c.reduce((s, id) => s + participants.find((p) => p.id === id).average, 0) / c.length);
  assert.deepEqual(means, [105, 105]);
});

test("history mode avoids repeated pairs without considering averages", () => {
  const participants = Array.from({ length: 8 }, (_, i) => person(i + 1, 70 + i * 10));
  const getPairCount = (a, b) => Math.ceil(a / 2) === Math.ceil(b / 2) ? 10 : 0;
  const result = arrangeCarts({ participants, mode: "pair_minimize", getPairCount });
  check(participants, result);
  for (const cart of result.carts) for (const a of cart) for (const b of cart) if (a !== b) assert.equal(getPairCount(a, b), 0);
});

test("remaining auto fill pins either side of a companion pair and keeps manual positions", () => {
  const participants = [...Array.from({ length: 7 }, (_, i) => person(i + 1, 75 + i * 5)), person("guest_1", 95, 1)];
  for (const fixedCarts of [[[1, 2], [3]], [["guest_1", 2], [3]], [[], [1, 2, 3]]]) {
    const before = structuredClone(fixedCarts);
    const result = arrangeCarts({ participants, fixedCarts });
    check(participants, result);
    fixedCarts.forEach((cart, i) => assert.deepEqual(result.carts[i].slice(0, cart.length), cart));
    assert.deepEqual(fixedCarts, before);
  }
});

test("remaining auto fill rejects full or split pinned companion groups without mutating", () => {
  const participants = [...Array.from({ length: 7 }, (_, i) => person(i + 1)), person("guest_1", 100, 1)];
  const fixedCarts = [[1, 2, 3, 4], [5, 6, 7]];
  assert.throws(() => arrangeCarts({ participants, fixedCarts }), /동반자까지 넣으면 4명을 초과/);
  assert.deepEqual(fixedCarts, [[1, 2, 3, 4], [5, 6, 7]]);
  assert.throws(() => arrangeCarts({ participants, fixedCarts: [[1], ["guest_1"]] }), /서로 다른 카트/);
});

test("fragmented manual free seats cannot swallow a larger companion group", () => {
  const participants = [...Array.from({ length: 8 }, (_, i) => person(i + 1)), person("g1", 90, 8), person("g2", 95, 8)];
  const fixedCarts = [[1, 2, 3], [4, 5, 6], [7]];
  const result = arrangeCarts({ participants, fixedCarts });
  check(participants, result);
  assert.deepEqual(result.carts.map((c) => c.length), [3, 3, 4]);
});

test("A/B seeding counts companion members and retains manual team choices", () => {
  const participants = grouped([2, 2, 1, 1, 1, 1]);
  const assignment = seedTeams(participants);
  const seeded = participants.map((p) => ({ ...p, team: assignment[key(p.pairedWith ?? p.id)] }));
  assert.equal(seeded.filter((p) => p.team === "A").length, 4);
  assert.equal(seeded.filter((p) => p.team === "B").length, 4);
  const leader = key(participants[0].id);
  const changed = seedTeams(participants, { [leader]: "B" });
  assert.equal(changed[leader], "B");
  check(seeded, arrangeCarts({ participants: seeded, mode: "ab_team" }), true);
  const latePair = [...Array.from({ length: 7 }, (_, i) => person(i + 1, 70 + i * 6)), person("guest_1", 125, 7)];
  const teams = seedTeams(latePair);
  const total = (team) => latePair.filter((p) => teams[key(p.pairedWith ?? p.id)] === team).reduce((s, p) => s + p.average, 0);
  assert.equal(Math.abs(total("A") - total("B")), 13);
  const finalParticipants = latePair.map((p) => ({ ...p, team: teams[key(p.pairedWith ?? p.id)] }));
  const finalCarts = arrangeCarts({ participants: finalParticipants, mode: "ab_team", history: false }).carts;
  const averages = finalCarts.map((cart) => cart.reduce((s, id) => s + latePair.find((p) => p.id === id).average, 0) / cart.length);
  assert.equal(Math.abs(averages[0] - averages[1]), 15.25);
});

test("remaining auto fill honors A/B limits and A/B seat order", () => {
  const participants = [person(1, 70, null, "A"), person("g1", 90, 1, "A"), person(2, 80, null, "A"), person(3, 95, null, "A"), ...[4,5,6,7].map((id) => person(id, 100, null, "B"))];
  const fixedCarts = [[4, 1], [5]];
  const result = arrangeCarts({ participants, fixedCarts, mode: "ab_team" });
  check(participants, result, true);
  for (const [index, cart] of fixedCarts.entries()) for (const id of cart) assert.ok(result.carts[index].includes(id));
  assert.throws(() => arrangeCarts({ participants, mode: "ab_team", fixedCarts: [[1,2], []] }), /카트별 A\/B 인원/);
});

test("all A/B balance/history toggles keep capacity, teams and companions", () => {
  for (const count of [4, 5, 6, 7, 8, 10, 12, 16]) {
    const participants = Array.from({ length: count }, (_, i) => person(i + 1, 75 + i * 3, null, i < Math.ceil(count / 2) ? "A" : "B"));
    for (const balance of [true, false]) for (const history of [true, false]) {
      const result = arrangeCarts({ participants, mode: "ab_team", balance, history, getPairCount: (a, b) => (a + b) % 3 });
      check(participants, result, true);
    }
  }
  const participants = [person(1, 90, null, "A"), person("g1", 95, 1, "A"), person(2, 80, null, "A"), person("g2", 100, 2, "A"), ...[3,4,5,6].map((id) => person(id, 100, null, "B"))];
  check(participants, arrangeCarts({ participants, mode: "ab_team" }), true);
});

test("A/B impossible team counts and three-person same-team groups are explained", () => {
  const participants = Array.from({ length: 8 }, (_, i) => person(i + 1, 90, null, i < 6 ? "A" : "B"));
  assert.throws(() => arrangeCarts({ participants, mode: "ab_team" }), /A팀 6명·B팀 2명/);
  const tooLarge = grouped([3, 1, 1, 1, 1, 1]).map((p) => ({ ...p, team: "A" }));
  assert.throws(() => arrangeCarts({ participants: tooLarge, mode: "ab_team" }), /3명 이상 동반 묶음/);
});

test("duplicate, stale, overfull and incomplete cart contents are validated", () => {
  const participants = Array.from({ length: 6 }, (_, i) => person(i + 1));
  assert.throws(() => validateCarts(participants, [[1,2,3,4,5]]), /정원은 4명/);
  assert.throws(() => validateCarts(participants, [[1], [1]]), /여러 카트/);
  assert.throws(() => validateCarts(participants, [[99]]), /참석자가 아닌/);
  assert.throws(() => validateCarts(participants, [[1]], { requireAll: true }), /미배치/);
  assert.doesNotThrow(() => validateCarts(participants, [[1]]));
  assert.throws(() => arrangeCarts({ participants: [person(1), person("1")] }), /중복/);
  assert.throws(() => arrangeCarts({ participants: [person(1, 100, 99)] }), /동반자가 참석자에 없습니다/);
  assert.deepEqual(arrangeCarts({ participants: [] }).carts, []);
});

test("deterministic mixed guest scenarios keep hard constraints in every mode", () => {
  let seed = 7291;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let run = 0; run < 70; run++) {
    const sizes = Array.from({ length: 2 + Math.floor(random() * 5) }, () => 1 + Math.floor(random() * 4));
    const participants = grouped(sizes);
    for (const mode of normalModes) check(participants, arrangeCarts({ participants, mode, getPairCount: (a, b) => (key(a).length + key(b).length) % 4 }));
  }
});
