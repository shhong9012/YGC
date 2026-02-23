import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./lib/supabase";

// ═══ RULES from 정관(251119) ═══
const F1 = [
  { rank: 1, pts: 25 }, { rank: 2, pts: 18 }, { rank: 3, pts: 15 },
  { rank: 4, pts: 12 }, { rank: 5, pts: 10 }, { rank: 6, pts: 8 },
];
const getPts = (r) => F1.find((f) => f.rank === r)?.pts || 0;

const ACTIVE_MONTHS = [3, 4, 5, 6, 8, 9, 10, 11];
const REQUIRED_ATTENDANCE = 5;
const DUES = 1500000;
const GOAL_REFUND = 500000;

const MEMBERS_PER_ROUND = 12;
const EXPENSE_CATEGORIES = [
  { id: "food", label: "식사", icon: "🍽️" },
  { id: "prize", label: "상품", icon: "🎁" },
  { id: "green_fee", label: "그린피", icon: "⛳" },
  { id: "cart", label: "카트비", icon: "🚗" },
  { id: "caddie", label: "캐디피", icon: "🏌️" },
  { id: "etc", label: "기타", icon: "📦" },
];
const EXPENSE_TARGET_MIN = 100000;
const EXPENSE_TARGET_MAX = 150000;
const AWARD_TYPES = [
  { id: "longest", label: "롱기스트" },
  { id: "nearpin", label: "니어핀" },
  { id: "eagle", label: "이글" },
  { id: "lucky", label: "행운상" },
  { id: "cart1", label: "카트배 1등" },
  { id: "cart2", label: "카트배 2등" },
  { id: "improved", label: "개선상" },
  { id: "handi_improved", label: "핸디개선상" },
  { id: "etc", label: "기타" },
];

const C = {
  bg: "#0a0e17", sf: "#111827", card: "#1a2235", cardAlt: "#1e2a40",
  accent: "#10b981", accentDim: "rgba(16,185,129,0.12)",
  gold: "#fbbf24", silver: "#9ca3af", bronze: "#b45309",
  red: "#ef4444", redDim: "rgba(239,68,68,0.1)",
  blue: "#3b82f6", blueDim: "rgba(59,130,246,0.1)",
  purple: "#8b5cf6", purpleDim: "rgba(139,92,246,0.1)",
  warn: "#f59e0b", warnDim: "rgba(245,158,11,0.1)",
  text: "#e2e8f0", mid: "#94a3b8", dim: "#4b5563",
  border: "#1f2937", white: "#fff",
};

const fmt = (n) => n?.toLocaleString("ko-KR") ?? "-";
const fmtW = (n) => `₩${fmt(n)}`;

const TABS = [
  { id: "standings", label: "챔피언십", icon: "🏆" },
  { id: "round", label: "월례회", icon: "⛳" },
  { id: "hat", label: "모자", icon: "🧢" },
  { id: "attend", label: "출석", icon: "📋" },
  { id: "dues", label: "회비", icon: "💰" },
  { id: "expenses", label: "지출", icon: "💳" },
  { id: "members", label: "멤버", icon: "👥" },
  { id: "rules", label: "정관", icon: "📜" },
];

// ═══ SUPABASE DATA LAYER ═══
async function fetchAll() {
  const [
    { data: members },
    { data: rounds },
    { data: attendees },
    { data: scoresData },
    { data: cartTeamsData },
    { data: awardsData },
    { data: settingsData },
    { data: expensesData },
  ] = await Promise.all([
    supabase.from("members").select("*").order("id"),
    supabase.from("rounds").select("*").order("id"),
    supabase.from("round_attendees").select("*"),
    supabase.from("scores").select("*"),
    supabase.from("cart_teams").select("*"),
    supabase.from("awards").select("*"),
    supabase.from("settings").select("*"),
    supabase.from("expenses").select("*"),
  ]);

  const settingsMap = {};
  (settingsData || []).forEach((s) => { settingsMap[s.key] = s.value; });

  const roundList = (rounds || []).map((r) => {
    const rAtt = (attendees || []).filter((a) => a.round_id === r.id).map((a) => a.member_id);
    const rScores = (scoresData || []).filter((s) => s.round_id === r.id).map((s) => ({ id: s.member_id, score: s.score }));
    const rCarts = (cartTeamsData || []).filter((c) => c.round_id === r.id);
    const cartNums = [...new Set(rCarts.map((c) => c.cart_number))].sort((a, b) => a - b);
    const carts = cartNums.map((n) => rCarts.filter((c) => c.cart_number === n).map((c) => c.member_id));
    const rAwards = (awardsData || []).filter((a) => a.round_id === r.id).map((a) => ({ name: a.award_type, winner: a.winner_name }));
    const rExpenses = (expensesData || []).filter((e) => e.round_id === r.id).map((e) => ({ id: e.id, category: e.category, itemName: e.item_name, amount: e.amount }));
    return { id: r.id, date: r.date, course: r.course, attendees: rAtt, scores: rScores, cartTeams: carts, awards: rAwards, expenses: rExpenses };
  });

  return {
    members: (members || []).map((m) => ({
      id: m.id, name: m.name, target: m.target_score, nextTarget: m.next_target,
      active: m.active, duesPaid: m.dues_paid, goalAchieved: m.goal_achieved,
    })),
    rounds: roundList,
    hatHolder: settingsMap.hat_holder ?? null,
    hatSince: settingsMap.hat_since ?? null,
    season: settingsMap.season ? Number(settingsMap.season) : 2026,
  };
}

// ═══ LOGIN SCREEN ═══
function LoginScreen() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit','Noto Sans KR',sans-serif", color: C.text, padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: 64, height: 64, borderRadius: 16, background: `linear-gradient(135deg,${C.accent},#059669)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, marginBottom: 16, boxShadow: `0 8px 24px rgba(16,185,129,0.3)` }}>🧢</div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>ㄱㅈㅂ <span style={{ color: C.accent }}>GOLF LEAGUE</span></h1>
      <p style={{ margin: "0 0 32px", fontSize: 12, color: C.dim }}>2026 SEASON · F1 CHAMPIONSHIP</p>
      <button onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://shhong9012.github.io/YGC/" } })}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 28px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Google로 로그인
      </button>
    </div>
  );
}

// ═══ ACCESS DENIED ═══
function AccessDenied({ email }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit','Noto Sans KR',sans-serif", color: C.text, padding: 20, textAlign: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
      <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: C.red }}>접근 권한 없음</h2>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: C.mid }}>{email}</p>
      <p style={{ margin: "0 0 24px", fontSize: 12, color: C.dim }}>등록된 멤버만 접근할 수 있습니다.<br/>관리자에게 문의하세요.</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://shhong9012.github.io/YGC/" } })}
          style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          다른 계정으로 로그인
        </button>
        <button onClick={() => supabase.auth.signOut()}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: C.redDim, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          로그아웃
        </button>
      </div>
    </div>
  );
}

// ═══ MAIN APP ═══
export default function App() {
  const [data, setData] = useState({ members: [], rounds: [], hatHolder: null, hatSince: null, season: 2026 });
  const [tab, setTab] = useState("standings");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const refetchTimer = useRef(null);

  // Auth state
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const checkUserRole = useCallback(async (email) => {
    const { data: row, error } = await supabase
      .from("allowed_users")
      .select("role")
      .eq("email", email)
      .single();
    if (error) console.error("allowed_users query error:", error);
    return row?.role || null;
  }, []);

  // Auth effect
  useEffect(() => {
    console.log("[AUTH] init");
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      console.log("[AUTH] getSession:", s?.user?.email || "no session");
      setSession(s);
      try {
        if (s?.user?.email) {
          const role = await checkUserRole(s.user.email);
          console.log("[AUTH] role:", role);
          setUserRole(role);
        }
      } catch (err) {
        console.error("[AUTH] Role check failed:", err);
      }
      setAuthLoading(false);
      console.log("[AUTH] authLoading → false");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log("[AUTH] onAuthStateChange:", event, s?.user?.email);
      setSession(s);
      try {
        if (s?.user?.email) {
          const role = await checkUserRole(s.user.email);
          console.log("[AUTH] role (change):", role);
          setUserRole(role);
        } else {
          setUserRole(null);
        }
      } catch (err) {
        console.error("[AUTH] Role check failed:", err);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkUserRole]);

  const isAdmin = userRole === "admin";

  const refetch = useCallback(async () => {
    try {
      const d = await fetchAll();
      setData(d);
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
    }
  }, []);

  const debouncedRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => refetch(), 300);
  }, [refetch]);

  // Initial load — only after auth confirmed
  useEffect(() => {
    if (!userRole) return;
    fetchAll()
      .then((d) => { setData(d); setReady(true); setError(null); })
      .catch((err) => { console.error(err); setError(err.message); setReady(true); });
  }, [userRole]);

  // Realtime subscription — only after auth confirmed
  useEffect(() => {
    if (!userRole) return;
    const tables = ["members", "rounds", "round_attendees", "scores", "cart_teams", "awards", "hat_history", "settings", "expenses"];
    let channel = supabase.channel("db-sync");
    tables.forEach((t) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: t }, () => debouncedRefetch());
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userRole, debouncedRefetch]);

  // ═══ DB Mutation Functions ═══
  const db = useMemo(() => ({
    updateMember: async (id, fields) => {
      if (!isAdmin) return;
      // Optimistic
      setData((prev) => {
        const next = JSON.parse(JSON.stringify(prev));
        const m = next.members.find((x) => x.id === id);
        if (m) Object.assign(m, fields);
        return next;
      });
      const mapped = {};
      if ("target" in fields) mapped.target_score = fields.target;
      if ("active" in fields) mapped.active = fields.active;
      if ("duesPaid" in fields) mapped.dues_paid = fields.duesPaid;
      if ("goalAchieved" in fields) mapped.goal_achieved = fields.goalAchieved;
      await supabase.from("members").update(mapped).eq("id", id);
    },

    addMember: async (name, target) => {
      if (!isAdmin) return;
      const { data: ins } = await supabase
        .from("members")
        .insert({ name, target_score: target, next_target: null })
        .select()
        .single();
      if (ins) {
        setData((prev) => {
          const next = JSON.parse(JSON.stringify(prev));
          next.members.push({
            id: ins.id, name: ins.name, target: ins.target_score, nextTarget: ins.next_target,
            active: ins.active, duesPaid: ins.dues_paid, goalAchieved: ins.goal_achieved,
          });
          return next;
        });
      }
    },

    saveRound: async ({ date, course, attendees, scores, cartTeams, awards, worstScorer }) => {
      if (!isAdmin) return;
      const { data: round } = await supabase
        .from("rounds")
        .insert({ date, course })
        .select()
        .single();
      if (!round) return;

      const promises = [];

      if (attendees.length > 0) {
        promises.push(
          supabase.from("round_attendees").insert(
            attendees.map((mid) => ({ round_id: round.id, member_id: mid }))
          )
        );
      }

      if (scores.length > 0) {
        const sorted = [...scores].sort((a, b) => a.score - b.score);
        promises.push(
          supabase.from("scores").insert(
            sorted.map((s, i) => ({
              round_id: round.id, member_id: s.id, score: s.score,
              rank: i + 1, points: getPts(i + 1),
            }))
          )
        );
      }

      if (cartTeams.length > 0) {
        const rows = [];
        cartTeams.forEach((cart, ci) => {
          cart.forEach((mid) => { rows.push({ round_id: round.id, cart_number: ci + 1, member_id: mid }); });
        });
        if (rows.length > 0) promises.push(supabase.from("cart_teams").insert(rows));
      }

      if (awards.length > 0) {
        promises.push(
          supabase.from("awards").insert(
            awards.map((a) => ({ round_id: round.id, award_type: a.name, winner_name: a.winner }))
          )
        );
      }

      if (worstScorer) {
        promises.push(
          supabase.from("hat_history").insert({
            round_id: round.id, holder_id: worstScorer.id, score: worstScorer.score, date,
          })
        );
        promises.push(supabase.from("settings").upsert({ key: "hat_holder", value: worstScorer.id }));
        promises.push(supabase.from("settings").upsert({ key: "hat_since", value: date }));
      }

      await Promise.all(promises);
      await refetch();
    },

    addExpense: async (roundId, category, itemName, amount) => {
      if (!isAdmin) return;
      await supabase.from("expenses").insert({
        round_id: roundId, category, item_name: itemName, amount,
      });
      await refetch();
    },

    deleteExpense: async (expenseId) => {
      if (!isAdmin) return;
      await supabase.from("expenses").delete().eq("id", expenseId);
      await refetch();
    },

    refetch,
  }), [refetch, isAdmin]);

  // ═══ Computed ═══
  const mm = useMemo(() => {
    const m = {};
    data.members.forEach((mem) => {
      const scores = [];
      data.rounds.forEach((r) => { const s = r.scores?.find((x) => x.id === mem.id); if (s) scores.push(s.score); });
      m[mem.id] = { ...mem, avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null, played: scores.length, scores, bestScore: scores.length ? Math.min(...scores) : null };
    });
    return m;
  }, [data]);

  const standings = useMemo(() => {
    const pts = {};
    data.members.forEach((m) => { pts[m.id] = { total: 0, rounds: 0, wins: 0, podiums: 0, history: [] }; });
    data.rounds.forEach((r) => {
      if (!r.scores?.length) return;
      const sorted = [...r.scores].sort((a, b) => a.score - b.score);
      sorted.forEach((s, i) => {
        const rank = i + 1, p = getPts(rank);
        if (!pts[s.id]) return;
        pts[s.id].total += p; pts[s.id].rounds++;
        if (rank === 1) pts[s.id].wins++;
        if (rank <= 3) pts[s.id].podiums++;
        pts[s.id].history.push({ roundId: r.id, date: r.date, rank, pts: p, score: s.score });
      });
    });
    return Object.entries(pts).map(([id, d]) => ({ id: Number(id), ...d })).sort((a, b) => b.total - a.total || a.wins < b.wins ? 1 : -1);
  }, [data]);

  const attendance = useMemo(() => {
    const att = {};
    data.members.forEach((m) => { att[m.id] = { count: 0, months: new Set() }; });
    data.rounds.forEach((r) => {
      const mo = new Date(r.date).getMonth() + 1;
      r.attendees?.forEach((id) => {
        if (att[id]) { att[id].count++; att[id].months.add(mo); }
      });
    });
    return att;
  }, [data]);

  // Auth guards
  if (authLoading) return <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontFamily: "'Outfit', sans-serif" }}>로딩 중...</div>;
  if (!session) return <LoginScreen />;
  if (!userRole) return <AccessDenied email={session.user?.email} />;

  if (!ready) return <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontFamily: "'Outfit', sans-serif" }}>로딩 중...</div>;

  if (error) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.red, fontFamily: "'Outfit', sans-serif", padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>서버 연결 실패</div>
      <div style={{ fontSize: 12, color: C.mid, marginBottom: 16 }}>{error}</div>
      <button onClick={() => { setError(null); setReady(false); fetchAll().then((d) => { setData(d); setReady(true); setError(null); }).catch((e) => { setError(e.message); setReady(true); }); }}
        style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: C.accent, color: "#000", fontWeight: 600, cursor: "pointer" }}>다시 시도</button>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Outfit','Noto Sans KR',sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box} input,button,select{font-family:inherit}
        ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .card{animation:fadeIn .25s ease-out}
      `}</style>

      <header style={{ background: `linear-gradient(135deg,#0f1a12,#111827,#0f1520)`, padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${C.accent},#059669)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: `0 4px 12px rgba(16,185,129,0.3)` }}>🧢</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.5 }}>ㄱㅈㅂ <span style={{ color: C.accent }}>GOLF LEAGUE</span></h1>
            <p style={{ margin: 0, fontSize: 10, color: C.dim, letterSpacing: 1 }}>{data.season} SEASON · F1 CHAMPIONSHIP · 매월 셋째 화 태광CC</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: C.mid, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user?.email}</div>
              {isAdmin && <span style={{ fontSize: 9, color: C.gold, background: `${C.gold}20`, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>관리자</span>}
            </div>
            <button onClick={() => supabase.auth.signOut()}
              style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.sf, color: C.mid, fontSize: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <nav style={{ background: C.sf, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, overflowX: "auto" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: "0 0 auto", minWidth: 56, padding: "10px 8px 8px", background: "transparent", border: "none",
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab === t.id ? C.accent : C.dim, cursor: "pointer", fontSize: 11, fontWeight: tab === t.id ? 600 : 400,
            }}>
              <span style={{ display: "block", fontSize: 16, marginBottom: 1 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "14px 12px" }}>
        {tab === "standings" && <Standings data={data} mm={mm} standings={standings} />}
        {tab === "round" && <RoundMgr data={data} db={db} mm={mm} isAdmin={isAdmin} />}
        {tab === "hat" && <HatTracker data={data} mm={mm} />}
        {tab === "attend" && <Attendance data={data} mm={mm} attendance={attendance} />}
        {tab === "dues" && <Dues data={data} db={db} mm={mm} isAdmin={isAdmin} />}
        {tab === "expenses" && <ExpensesMgr data={data} db={db} mm={mm} isAdmin={isAdmin} />}
        {tab === "members" && <MembersMgr data={data} db={db} mm={mm} isAdmin={isAdmin} />}
        {tab === "rules" && <Rules />}
      </main>
    </div>
  );
}

// ═══ SHARED ═══
function Card({ title, badge, accent, children, style: sx }) {
  return (
    <div className="card" style={{ background: C.card, borderRadius: 12, padding: "16px", marginBottom: 12, border: `1px solid ${C.border}`, ...(accent ? { borderLeft: `3px solid ${accent}` } : {}), ...sx }}>
      {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: accent || C.accent }}>{title}</h3>
        {badge && <span style={{ fontSize: 10, color: C.dim, background: C.sf, padding: "2px 8px", borderRadius: 5 }}>{badge}</span>}
      </div>}
      {children}
    </div>
  );
}
function Btn({ children, onClick, color = C.accent, ghost, disabled, style: sx }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: disabled ? "default" : "pointer", background: ghost ? `${color}15` : color, color: ghost ? color : "#000", fontWeight: 600, fontSize: 12, opacity: disabled ? .4 : 1, transition: "all .15s", ...sx }}>{children}</button>;
}
function Inp({ label, ...p }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    {label && <label style={{ fontSize: 10, color: C.dim, fontWeight: 500 }}>{label}</label>}
    <input {...p} style={{ padding: "8px 10px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 13, outline: "none", width: "100%", ...p.style }} />
  </div>;
}
function Medal({ rank }) {
  const m = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return m[rank] ? <span style={{ fontSize: 16 }}>{m[rank]}</span> : <span style={{ fontSize: 12, color: C.dim, fontWeight: 600, minWidth: 22, textAlign: "center", display: "inline-block" }}>{rank}</span>;
}

// ═══ CHAMPIONSHIP STANDINGS ═══
function Standings({ data, mm, standings }) {
  const scored = standings.filter((s) => s.rounds > 0);
  const totalR = data.rounds.filter((r) => r.scores?.length).length;
  return (
    <div>
      <Card title="🏎️ F1 포인트 시스템 (제11조)" badge="상위 6명">
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {F1.map((f) => (
            <div key={f.rank} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 10px", borderRadius: 8, background: f.rank <= 3 ? `${[C.gold, C.silver, C.bronze][f.rank - 1]}12` : C.sf, border: `1px solid ${f.rank <= 3 ? `${[C.gold, C.silver, C.bronze][f.rank - 1]}30` : C.border}`, minWidth: 48 }}>
              <span style={{ fontSize: 10, color: C.dim }}>{f.rank}등</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: f.rank <= 3 ? [C.gold, C.silver, C.bronze][f.rank - 1] : C.text }}>{f.pts}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="🏆 시즌 챔피언십 순위" badge={`${totalR}R 진행`} accent={C.gold}>
        {scored.length === 0 ? <p style={{ color: C.dim, textAlign: "center", padding: 16, fontSize: 12 }}>월례회 스코어를 입력하면 자동 순위가 계산됩니다.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {scored.map((s, i) => {
              const m = mm[s.id]; if (!m) return null;
              const rank = i + 1, top3 = rank <= 3;
              const gap = i > 0 ? scored[0].total - s.total : 0;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: top3 ? `${[C.gold, C.silver, C.bronze][rank - 1]}06` : rank % 2 === 0 ? C.sf : "transparent", border: top3 ? `1px solid ${[C.gold, C.silver, C.bronze][rank - 1]}20` : "1px solid transparent" }}>
                  <Medal rank={rank} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: top3 ? 700 : 500, fontSize: 13 }}>{m.name}</span>
                    {m.avg && <span style={{ marginLeft: 6, fontSize: 10, color: C.dim }}>avg {m.avg}</span>}
                    <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                      {s.rounds}R · 🏆{s.wins} · 🥉{s.podiums}
                      {gap > 0 && <span style={{ color: C.red, marginLeft: 6 }}>-{gap}pts</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: top3 ? [C.gold, C.silver, C.bronze][rank - 1] : C.accent }}>{s.total}</div>
                    <div style={{ fontSize: 9, color: C.dim }}>pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {scored.length > 0 && (
        <Card title="📊 라운드별 포인트 흐름">
          {scored.slice(0, 8).map((s) => {
            const m = mm[s.id]; if (!m) return null;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, minWidth: 44, textAlign: "right", color: C.mid }}>{m.name}</span>
                <div style={{ flex: 1, display: "flex", gap: 2 }}>
                  {s.history.map((h, i) => (
                    <div key={i} title={`R${h.roundId} ${h.score}타 → +${h.pts}pts`} style={{ height: 20, minWidth: 16, borderRadius: 3, background: h.pts >= 15 ? C.accent : h.pts >= 8 ? C.blue : C.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#000", opacity: h.pts > 0 ? 1 : .3 }}>{h.pts || ""}</div>
                  ))}
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.accent, minWidth: 30, textAlign: "right" }}>{s.total}</span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ═══ ROUND MANAGER ═══
function RoundMgr({ data, db, mm, isAdmin }) {
  const [date, setDate] = useState(""); const [course, setCourse] = useState("태광CC");
  const [sel, setSel] = useState([]); const [scores, setScores] = useState({});
  const [awards, setAwards] = useState([]); const [awName, setAwName] = useState(""); const [awWinner, setAwWinner] = useState("");
  const [step, setStep] = useState(1);
  const [cartTeams, setCartTeams] = useState([]);
  const [saving, setSaving] = useState(false);

  const active = data.members.filter((m) => m.active);
  const toggle = (id) => setSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const makeCartTeams = () => {
    if (sel.length < 4) return;
    const sorted = sel.map((id) => ({ id, avg: mm[id]?.avg || 100 })).sort((a, b) => a.avg - b.avg);
    const numCarts = Math.ceil(sorted.length / 4);
    const carts = Array.from({ length: numCarts }, () => []);
    sorted.forEach((p, i) => {
      const cartIdx = i % numCarts;
      const round = Math.floor(i / numCarts);
      const idx = round % 2 === 0 ? cartIdx : numCarts - 1 - cartIdx;
      carts[idx].push(p.id);
    });
    setCartTeams(carts);
  };

  const rankPreview = useMemo(() => {
    return Object.entries(scores).filter(([_, v]) => v && Number(v) > 0).map(([id, v]) => ({ id: Number(id), score: Number(v) })).sort((a, b) => a.score - b.score).map((s, i) => ({ ...s, rank: i + 1, pts: getPts(i + 1) }));
  }, [scores]);

  const worstScorer = rankPreview.length > 0 ? rankPreview[rankPreview.length - 1] : null;

  const awardedWinners = useMemo(() => new Set(awards.map((a) => a.winner).filter(Boolean)), [awards]);

  const autoRecommend = useMemo(() => {
    const recs = {};
    if (rankPreview.length === 0) return recs;
    // 개선상: (avg - current score) 가장 큰 사람
    let bestImproved = null, bestImpDiff = -Infinity;
    rankPreview.forEach((s) => {
      const avg = mm[s.id]?.avg;
      if (avg != null) {
        const diff = avg - s.score;
        if (diff > bestImpDiff) { bestImpDiff = diff; bestImproved = { id: s.id, name: mm[s.id]?.name, diff: diff.toFixed(1) }; }
      }
    });
    if (bestImproved && bestImpDiff > 0) recs.improved = bestImproved;
    // 핸디개선상: (첫 라운드 타수 - 이번 타수) 가장 큰 사람
    let bestHandi = null, bestHandiDiff = -Infinity;
    rankPreview.forEach((s) => {
      const firstRound = data.rounds.find((r) => r.scores?.some((sc) => sc.id === s.id));
      if (firstRound) {
        const firstScore = firstRound.scores.find((sc) => sc.id === s.id)?.score;
        if (firstScore != null) {
          const diff = firstScore - s.score;
          if (diff > bestHandiDiff) { bestHandiDiff = diff; bestHandi = { id: s.id, name: mm[s.id]?.name, diff }; }
        }
      }
    });
    if (bestHandi && bestHandiDiff > 0) recs.handi_improved = bestHandi;
    // 행운상: 상위 3명 제외, 미수상자 중 랜덤
    const top3Ids = new Set(rankPreview.slice(0, 3).map((s) => s.id));
    const candidates = rankPreview.filter((s) => !top3Ids.has(s.id) && !awardedWinners.has(mm[s.id]?.name));
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      recs.lucky = { id: pick.id, name: mm[pick.id]?.name };
    }
    return recs;
  }, [rankPreview, mm, data.rounds, awardedWinners]);

  const addAward = (name, winner) => {
    const n = name || awName.trim();
    const w = winner || awWinner;
    if (!n) return;
    if (w && awards.some((a) => a.winner === w)) {
      alert(`${w}님은 이미 수상했습니다.`);
      return;
    }
    setAwards((p) => [...p, { name: n, winner: w }]);
    setAwName(""); setAwWinner("");
  };

  const save = async () => {
    if (!date) return alert("날짜를 입력하세요");
    if (sel.length === 0) return alert("참석자를 선택하세요");
    setSaving(true);
    try {
      const scoreArr = Object.entries(scores).filter(([_, v]) => v && Number(v) > 0).map(([id, v]) => ({ id: Number(id), score: Number(v) }));
      await db.saveRound({
        date, course,
        attendees: sel,
        scores: scoreArr,
        cartTeams,
        awards: [...awards],
        worstScorer,
      });
      setStep(1); setDate(""); setCourse("태광CC"); setSel([]); setScores({}); setCartTeams([]); setAwards([]);
      alert("✅ 월례회가 저장되었습니다!");
    } catch (err) {
      console.error(err);
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Past rounds view (shared between admin and viewer)
  const pastRoundsView = (
    <Card title="📜 지난 월례회">
      {[...data.rounds].reverse().slice(0, 5).map((r) => {
        const sorted = r.scores ? [...r.scores].sort((a, b) => a.score - b.score) : [];
        return (
          <div key={r.id} style={{ padding: 10, background: C.sf, borderRadius: 8, marginBottom: 6, border: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>R{r.id} · {r.date} · {r.course}</div>
            {sorted.map((s, i) => (
              <div key={s.id} style={{ display: "flex", gap: 6, fontSize: 11, padding: "2px 0" }}>
                <Medal rank={i + 1} /><span style={{ flex: 1 }}>{mm[s.id]?.name}</span><span style={{ color: C.mid }}>{s.score}타</span>
                <span style={{ fontWeight: 700, color: getPts(i + 1) > 0 ? C.accent : C.dim, minWidth: 24, textAlign: "right" }}>{getPts(i + 1) > 0 ? `+${getPts(i + 1)}` : "-"}</span>
              </div>
            ))}
            {r.awards?.length > 0 && <div style={{ marginTop: 4, fontSize: 10, color: C.gold }}>🏆 {r.awards.map((a) => `${a.name}:${a.winner}`).join(" · ")}</div>}
          </div>
        );
      })}
    </Card>
  );

  if (!isAdmin) return <div>{pastRoundsView}</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
        {["①참석", "②스코어", "③상품/저장"].map((l, i) => (
          <button key={i} onClick={() => setStep(i + 1)} style={{ flex: 1, padding: 7, borderRadius: 7, border: "none", cursor: "pointer", background: step === i + 1 ? C.accentDim : C.sf, color: step === i + 1 ? C.accent : C.dim, fontSize: 11, fontWeight: step === i + 1 ? 600 : 400 }}>{l}</button>
        ))}
      </div>

      {step === 1 && (<>
        <Card title="📅 월례회 정보">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Inp label="날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Inp label="골프장" value={course} onChange={(e) => setCourse(e.target.value)} />
          </div>
        </Card>
        <Card title="🏌️ 참석자" badge={`${sel.length}명`}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <Btn ghost color={C.accent} onClick={() => setSel(active.map((m) => m.id))} style={{ fontSize: 10, padding: "3px 10px" }}>전체선택</Btn>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {active.map((m) => {
              const s = sel.includes(m.id);
              return <button key={m.id} onClick={() => toggle(m.id)} style={{ padding: "7px 12px", borderRadius: 16, border: "none", cursor: "pointer", background: s ? C.accent : C.sf, color: s ? "#000" : C.text, fontSize: 12, fontWeight: s ? 600 : 400 }}>{m.name}{mm[m.id]?.avg ? <span style={{ marginLeft: 3, fontSize: 9, opacity: .7 }}>({mm[m.id].avg})</span> : ""}</button>;
            })}
          </div>
          {sel.length >= 4 && (
            <div style={{ marginTop: 10 }}>
              <Btn onClick={makeCartTeams} color={C.blue} style={{ width: "100%", marginBottom: 8 }}>🚗 카트배 밸런스 편성 (제12조)</Btn>
              {cartTeams.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${cartTeams.length}, 1fr)`, gap: 6 }}>
                  {cartTeams.map((cart, ci) => {
                    const avg = cart.map((id) => mm[id]?.avg || 100);
                    const cartAvg = (avg.reduce((a, b) => a + b, 0) / avg.length).toFixed(1);
                    return (
                      <div key={ci} style={{ padding: 10, borderRadius: 8, background: C.sf, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.blue, marginBottom: 4 }}>🚗 {ci + 1}카트 <span style={{ fontWeight: 400, color: C.dim }}>avg {cartAvg}</span></div>
                        {cart.map((id) => <div key={id} style={{ fontSize: 12, padding: "2px 0" }}>{mm[id]?.name} <span style={{ color: C.dim, fontSize: 10 }}>{mm[id]?.avg || "-"}</span></div>)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {sel.length > 0 && <Btn onClick={() => setStep(2)} style={{ marginTop: 10, width: "100%" }}>다음 →</Btn>}
        </Card>
      </>)}

      {step === 2 && (<>
        <Card title="📝 타수 입력" badge="26년부터 노핸디" accent={C.gold}>
          <div style={{ display: "grid", gap: 4 }}>
            {sel.map((id) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{mm[id]?.name}</span>
                <span style={{ fontSize: 10, color: C.dim }}>{mm[id]?.avg ? `avg ${mm[id].avg}` : ""}</span>
                <input type="number" placeholder="타수" value={scores[id] || ""} onChange={(e) => setScores((p) => ({ ...p, [id]: e.target.value }))}
                  style={{ width: 64, padding: "7px 8px", textAlign: "center", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 13, fontWeight: 600, outline: "none" }} />
              </div>
            ))}
          </div>
        </Card>

        {rankPreview.length > 0 && (
          <Card title="🏁 순위 & F1 포인트 미리보기" accent={C.accent}>
            {rankPreview.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: r.rank <= 3 ? `${[C.gold, C.silver, C.bronze][r.rank - 1]}06` : "transparent" }}>
                <Medal rank={r.rank} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: r.rank <= 3 ? 600 : 400 }}>{mm[r.id]?.name}</span>
                <span style={{ fontSize: 12, color: C.mid }}>{r.score}타</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: r.pts > 0 ? C.accent : C.dim, minWidth: 30, textAlign: "right" }}>{r.pts > 0 ? `+${r.pts}` : "-"}</span>
              </div>
            ))}
            {worstScorer && (
              <div style={{ marginTop: 8, padding: 8, background: C.redDim, borderRadius: 6, fontSize: 11, color: C.red }}>
                🧢 ㄱㅈㅂ 모자 → <strong>{mm[worstScorer.id]?.name}</strong> ({worstScorer.score}타)
              </div>
            )}
          </Card>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <Btn ghost color={C.mid} onClick={() => setStep(1)} style={{ flex: 1 }}>← 이전</Btn>
          <Btn onClick={() => setStep(3)} style={{ flex: 1 }}>다음 →</Btn>
        </div>
      </>)}

      {step === 3 && (<>
        <Card title="🏆 상품 기록 (제14조)" badge={`${awards.length}건`}>
          <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
            <select value={awName} onChange={(e) => setAwName(e.target.value)} style={{ flex: 1, padding: "7px 8px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }}>
              <option value="">상품 종류</option>
              {AWARD_TYPES.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
            </select>
            <select value={awWinner} onChange={(e) => setAwWinner(e.target.value)} style={{ flex: 1, padding: "7px 8px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }}>
              <option value="">수상자</option>
              {sel.map((id) => {
                const won = awardedWinners.has(mm[id]?.name);
                return <option key={id} value={mm[id]?.name} disabled={won}>{mm[id]?.name}{won ? " ✓수상완료" : ""}</option>;
              })}
            </select>
            <Btn onClick={() => addAward()} style={{ padding: "7px 12px" }}>+</Btn>
          </div>
          {awards.map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
              <span><span style={{ color: C.gold }}>🏆</span> {a.name} — <strong>{a.winner || "미정"}</strong></span>
              <button onClick={() => setAwards((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
          ))}
          {/* 수상 현황 */}
          {sel.length > 0 && (
            <div style={{ marginTop: 10, padding: 8, background: C.sf, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>수상 현황</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {sel.map((id) => {
                  const name = mm[id]?.name;
                  const won = awardedWinners.has(name);
                  return <span key={id} style={{ padding: "3px 8px", borderRadius: 10, fontSize: 10, fontWeight: 500, background: won ? C.accentDim : C.redDim, color: won ? C.accent : C.red }}>{name}{won ? " ✓" : " ✗"}</span>;
                })}
              </div>
            </div>
          )}
        </Card>

        {/* 자동 추천 */}
        {rankPreview.length > 0 && (Object.keys(autoRecommend).length > 0) && (
          <Card title="🤖 자동 추천" accent={C.purple}>
            {autoRecommend.improved && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <div><span style={{ fontSize: 12, fontWeight: 600 }}>개선상</span><span style={{ fontSize: 10, color: C.mid, marginLeft: 6 }}>{autoRecommend.improved.name} (avg 대비 {autoRecommend.improved.diff}타 개선)</span></div>
                <Btn ghost color={C.purple} onClick={() => addAward("개선상", autoRecommend.improved.name)} style={{ padding: "3px 10px", fontSize: 10 }}>추가</Btn>
              </div>
            )}
            {autoRecommend.handi_improved && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <div><span style={{ fontSize: 12, fontWeight: 600 }}>핸디개선상</span><span style={{ fontSize: 10, color: C.mid, marginLeft: 6 }}>{autoRecommend.handi_improved.name} (첫R 대비 {autoRecommend.handi_improved.diff}타 개선)</span></div>
                <Btn ghost color={C.purple} onClick={() => addAward("핸디개선상", autoRecommend.handi_improved.name)} style={{ padding: "3px 10px", fontSize: 10 }}>추가</Btn>
              </div>
            )}
            {autoRecommend.lucky && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                <div><span style={{ fontSize: 12, fontWeight: 600 }}>행운상</span><span style={{ fontSize: 10, color: C.mid, marginLeft: 6 }}>{autoRecommend.lucky.name} (상위3 제외 미수상자 랜덤)</span></div>
                <Btn ghost color={C.purple} onClick={() => addAward("행운상", autoRecommend.lucky.name)} style={{ padding: "3px 10px", fontSize: 10 }}>추가</Btn>
              </div>
            )}
          </Card>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <Btn ghost color={C.mid} onClick={() => setStep(2)} style={{ flex: 1 }}>← 이전</Btn>
          <Btn onClick={save} disabled={saving} style={{ flex: 2, padding: 12, fontSize: 14 }}>{saving ? "저장 중..." : "✅ 월례회 저장"}</Btn>
        </div>

        {pastRoundsView}
      </>)}
    </div>
  );
}

// ═══ HAT TRACKER ═══
function HatTracker({ data, mm }) {
  const holder = data.hatHolder ? mm[data.hatHolder] : null;
  const since = data.hatSince;
  const days = since ? Math.floor((new Date() - new Date(since)) / 86400000) : 0;

  const hatHistory = useMemo(() => {
    return data.rounds.filter((r) => r.scores?.length > 0).map((r) => {
      const sorted = [...r.scores].sort((a, b) => a.score - b.score);
      const worst = sorted[sorted.length - 1];
      return { roundId: r.id, date: r.date, holderId: worst.id, score: worst.score };
    });
  }, [data]);

  const hatCounts = useMemo(() => {
    const c = {};
    hatHistory.forEach((h) => { c[h.holderId] = (c[h.holderId] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [hatHistory]);

  return (
    <div>
      <Card accent={C.red}>
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 48 }}>🧢</div>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>현재 ㄱㅈㅂ 모자 보유자</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.red, margin: "4px 0" }}>{holder?.name || "미정"}</div>
          {since && <div style={{ fontSize: 12, color: C.mid }}>{since}부터 · <strong style={{ color: C.red }}>{days}일째</strong> 보유 중</div>}
          <div style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>제1조: 월례회 꼴찌가 보유 (26년부터 노핸디)</div>
          <div style={{ fontSize: 10, color: C.dim }}>제5조: 모자 착용 시 멀리건 1회 사용 가능</div>
        </div>
      </Card>

      <Card title="📊 모자 보유 횟수 순위">
        {hatCounts.length === 0 ? <p style={{ color: C.dim, fontSize: 12 }}>데이터 없음</p> : (
          hatCounts.map(([id, cnt], i) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 12 }}>
              <span style={{ minWidth: 50, textAlign: "right", color: C.mid }}>{mm[Number(id)]?.name}</span>
              <div style={{ flex: 1, height: 8, background: C.sf, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${(cnt / hatCounts[0][1]) * 100}%`, height: "100%", background: i === 0 ? C.red : C.warn, borderRadius: 4 }} />
              </div>
              <span style={{ fontWeight: 700, color: i === 0 ? C.red : C.text, minWidth: 20 }}>{cnt}회</span>
            </div>
          ))
        )}
      </Card>

      <Card title="📋 모자 이력">
        {hatHistory.length === 0 ? <p style={{ color: C.dim, fontSize: 12 }}>기록 없음</p> : (
          [...hatHistory].reverse().map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
              <span>R{h.roundId} · {h.date}</span>
              <span><strong style={{ color: C.red }}>{mm[h.holderId]?.name}</strong> ({h.score}타)</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ═══ ATTENDANCE ═══
function Attendance({ data, mm, attendance }) {
  const activeMembers = data.members.filter((m) => m.active);
  return (
    <div>
      <Card title="📋 출석 현황 (제10조)" badge={`${ACTIVE_MONTHS.length}회 중 ${REQUIRED_ATTENDANCE}회 필요`}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>활동월: 3, 4, 5, 6, 8, 9, 10, 11월 · 정기회원 유지: 8회 중 5회 이상</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: "6px 4px", textAlign: "left", color: C.dim, borderBottom: `1px solid ${C.border}` }}>이름</th>
                {ACTIVE_MONTHS.map((m) => <th key={m} style={{ padding: "6px 2px", textAlign: "center", color: C.dim, borderBottom: `1px solid ${C.border}` }}>{m}월</th>)}
                <th style={{ padding: "6px 4px", textAlign: "center", color: C.dim, borderBottom: `1px solid ${C.border}` }}>합계</th>
                <th style={{ padding: "6px 4px", textAlign: "center", color: C.dim, borderBottom: `1px solid ${C.border}` }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m) => {
                const att = attendance[m.id];
                const monthlyCount = ACTIVE_MONTHS.filter((mo) => att?.months.has(mo)).length;
                const ok = monthlyCount >= REQUIRED_ATTENDANCE;
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "6px 4px", fontWeight: 500 }}>{m.name}</td>
                    {ACTIVE_MONTHS.map((mo) => (
                      <td key={mo} style={{ padding: "6px 2px", textAlign: "center" }}>
                        {att?.months.has(mo) ? <span style={{ color: C.accent }}>✓</span> : <span style={{ color: C.dim }}>-</span>}
                      </td>
                    ))}
                    <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600 }}>{monthlyCount}/{ACTIVE_MONTHS.length}</td>
                    <td style={{ padding: "6px 4px", textAlign: "center", color: ok ? C.accent : C.red, fontWeight: 600 }}>{ok ? "✓정상" : "⚠미달"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══ DUES MANAGEMENT ═══
function Dues({ data, db, mm, isAdmin }) {
  const activeMembers = data.members.filter((m) => m.active);
  const totalDues = activeMembers.filter((m) => m.duesPaid).length * DUES;
  const totalRefund = activeMembers.filter((m) => m.goalAchieved).length * GOAL_REFUND;

  return (
    <div>
      <Card title="💰 회비 현황 (제9조)" accent={C.gold}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: C.dim }}>인당 회비</div><div style={{ fontSize: 16, fontWeight: 700 }}>{fmtW(DUES)}</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: C.dim }}>납입 합계</div><div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{fmtW(totalDues)}</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: C.dim }}>목표달성 환급</div><div style={{ fontSize: 16, fontWeight: 700, color: C.warn }}>{fmtW(totalRefund)}</div></div>
        </div>
      </Card>

      <Card title="🎯 목표타수 & 납입 현황">
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>목표 달성 시 50만원 수령. 달성 후 다음 목표 적용.</div>
        <div style={{ display: "grid", gap: 4 }}>
          {activeMembers.map((m) => {
            const info = mm[m.id];
            const achieved = info?.bestScore != null && info.bestScore <= m.target;
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.sf, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{m.name}</span>
                <span style={{ fontSize: 10, color: C.dim }}>목표 {m.target}타{m.target <= 85 ? "이하" : "미만"}</span>
                {info?.bestScore && <span style={{ fontSize: 10, color: achieved ? C.accent : C.mid }}>최저 {info.bestScore}타</span>}
                {isAdmin ? (
                  <button onClick={() => db.updateMember(m.id, { duesPaid: !m.duesPaid })}
                    style={{ padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: m.duesPaid ? C.accentDim : C.redDim, color: m.duesPaid ? C.accent : C.red }}>
                    {m.duesPaid ? "납입✓" : "미납"}
                  </button>
                ) : (
                  <span style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: m.duesPaid ? C.accentDim : C.redDim, color: m.duesPaid ? C.accent : C.red }}>
                    {m.duesPaid ? "납입✓" : "미납"}
                  </span>
                )}
                {isAdmin ? (
                  <button onClick={() => db.updateMember(m.id, { goalAchieved: !m.goalAchieved })}
                    style={{ padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: m.goalAchieved ? C.gold + "20" : C.sf, color: m.goalAchieved ? C.gold : C.dim }}>
                    {m.goalAchieved ? "달성🎉" : "미달성"}
                  </button>
                ) : (
                  <span style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: m.goalAchieved ? C.gold + "20" : C.sf, color: m.goalAchieved ? C.gold : C.dim }}>
                    {m.goalAchieved ? "달성🎉" : "미달성"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ═══ MEMBERS ═══
function MembersMgr({ data, db, mm, isAdmin }) {
  const [name, setName] = useState(""); const [tgt, setTgt] = useState("");
  const [editId, setEditId] = useState(null); const [editTgt, setEditTgt] = useState("");

  const saveTarget = (id) => {
    const v = Number(editTgt);
    if (v > 0) db.updateMember(id, { target: v });
    setEditId(null);
  };

  const add = () => {
    if (!name.trim()) return;
    db.addMember(name.trim(), tgt ? Number(tgt) : 95);
    setName(""); setTgt("");
  };

  return (
    <div>
      {isAdmin && (
        <Card title="👥 멤버 추가 (제7,8조: 80% 찬성 필요)">
          <div style={{ display: "flex", gap: 6 }}>
            <input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
              style={{ flex: 2, padding: "8px 10px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }} />
            <input placeholder="목표타수" type="number" value={tgt} onChange={(e) => setTgt(e.target.value)}
              style={{ flex: 1, padding: "8px 10px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }} />
            <Btn onClick={add}>추가</Btn>
          </div>
        </Card>
      )}
      <Card title={`멤버 목록`} badge={`${data.members.length}명`}>
        {data.members.map((m) => {
          const info = mm[m.id];
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", borderRadius: 8, marginBottom: 4, background: m.active ? C.sf : C.bg, border: `1px solid ${m.active ? C.border : C.bg}`, opacity: m.active ? 1 : .4 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{m.name}</span>
                {isAdmin && editId === m.id ? (
                  <input type="number" value={editTgt} autoFocus onChange={(e) => setEditTgt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveTarget(m.id); if (e.key === "Escape") setEditId(null); }}
                    onBlur={() => saveTarget(m.id)}
                    style={{ marginLeft: 6, width: 50, padding: "2px 6px", background: C.card, border: `1px solid ${C.accent}`, borderRadius: 5, color: C.text, fontSize: 10, textAlign: "center" }} />
                ) : (
                  <span style={{ marginLeft: 6, fontSize: 10, color: C.dim, ...(isAdmin ? { cursor: "pointer", borderBottom: `1px dashed ${C.dim}` } : {}) }}
                    onClick={isAdmin ? () => { setEditId(m.id); setEditTgt(String(m.target)); } : undefined}>목표 {m.target}타</span>
                )}
                {info?.avg && <span style={{ marginLeft: 6, fontSize: 10, color: C.mid }}>avg {info.avg} · {info.played}R</span>}
                {info?.bestScore && <span style={{ marginLeft: 6, fontSize: 10, color: C.accent }}>best {info.bestScore}</span>}
              </div>
              {isAdmin && (
                <div style={{ display: "flex", gap: 4 }}>
                  <Btn ghost color={m.active ? C.accent : C.dim} onClick={() => db.updateMember(m.id, { active: !m.active })} style={{ padding: "3px 8px", fontSize: 10 }}>{m.active ? "활동" : "휴면"}</Btn>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ═══ EXPENSES MANAGER ═══
function ExpensesMgr({ data, db, mm, isAdmin }) {
  const [selRound, setSelRound] = useState("");
  const [category, setCategory] = useState("");
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");

  const roundsWithData = [...data.rounds].reverse();
  const round = data.rounds.find((r) => r.id === Number(selRound));
  const expenses = round?.expenses || [];
  const attendeeCount = round?.attendees?.length || MEMBERS_PER_ROUND;
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const perPerson = attendeeCount > 0 ? Math.round(totalExpense / attendeeCount) : 0;

  const statusColor = perPerson === 0 ? C.dim : perPerson >= EXPENSE_TARGET_MIN && perPerson <= EXPENSE_TARGET_MAX ? C.accent : C.warn;
  const statusLabel = perPerson === 0 ? "-" : perPerson >= EXPENSE_TARGET_MIN && perPerson <= EXPENSE_TARGET_MAX ? "적정 ✓" : perPerson < EXPENSE_TARGET_MIN ? "부족 ⚠" : "초과 ⚠";

  const handleAdd = async () => {
    if (!selRound || !category || !itemName.trim() || !amount) return;
    await db.addExpense(Number(selRound), category, itemName.trim(), Number(amount));
    setItemName(""); setAmount("");
  };

  // 시즌 요약
  const seasonSummary = useMemo(() => {
    const allExpenses = data.rounds.flatMap((r) => (r.expenses || []).map((e) => ({ ...e, roundId: r.id, attendees: r.attendees?.length || MEMBERS_PER_ROUND })));
    const totalAll = allExpenses.reduce((s, e) => s + e.amount, 0);
    const roundsWithExp = data.rounds.filter((r) => r.expenses?.length > 0);
    const avgPerRound = roundsWithExp.length > 0 ? Math.round(totalAll / roundsWithExp.length) : 0;
    // 카테고리별 합계
    const byCat = {};
    EXPENSE_CATEGORIES.forEach((c) => { byCat[c.id] = 0; });
    allExpenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    const maxCat = Math.max(...Object.values(byCat), 1);
    // 라운드별 인당 금액
    const perRound = data.rounds.filter((r) => r.expenses?.length > 0).map((r) => {
      const total = r.expenses.reduce((s, e) => s + e.amount, 0);
      const cnt = r.attendees?.length || MEMBERS_PER_ROUND;
      return { id: r.id, date: r.date, total, perPerson: Math.round(total / cnt), count: cnt };
    });
    return { totalAll, avgPerRound, byCat, maxCat, perRound, roundCount: roundsWithExp.length };
  }, [data.rounds]);

  return (
    <div>
      {/* 라운드 선택 */}
      <Card title="💳 라운드별 지출 관리">
        <select value={selRound} onChange={(e) => setSelRound(e.target.value)}
          style={{ width: "100%", padding: "9px 10px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 13 }}>
          <option value="">라운드 선택...</option>
          {roundsWithData.map((r) => (
            <option key={r.id} value={r.id}>R{r.id} · {r.date} · {r.course} ({r.attendees?.length || 0}명)</option>
          ))}
        </select>
      </Card>

      {/* 지출 상세 */}
      {round && (
        <Card title={`R${round.id} · ${round.date}`} badge={`${attendeeCount}명 참석`} accent={statusColor}>
          {/* 요약 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.dim }}>총 지출</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtW(totalExpense)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.dim }}>인당 금액</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: statusColor }}>{fmtW(perPerson)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.dim }}>목표 범위</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{statusLabel}</div>
              <div style={{ fontSize: 9, color: C.dim }}>{fmtW(EXPENSE_TARGET_MIN)}~{fmtW(EXPENSE_TARGET_MAX)}</div>
            </div>
          </div>

          {/* 지출 항목 목록 */}
          {expenses.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {expenses.map((e) => {
                const cat = EXPENSE_CATEGORIES.find((c) => c.id === e.category);
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <span style={{ fontSize: 16 }}>{cat?.icon || "📦"}</span>
                    <span style={{ fontSize: 10, color: C.mid, minWidth: 36 }}>{cat?.label || e.category}</span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{e.itemName}</span>
                    <span style={{ fontWeight: 600 }}>{fmtW(e.amount)}</span>
                    {isAdmin && <button onClick={() => db.deleteExpense(e.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>}
                  </div>
                );
              })}
            </div>
          )}

          {/* 항목 추가 폼 */}
          {isAdmin && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                style={{ flex: "1 1 80px", minWidth: 80, padding: "7px 8px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }}>
                <option value="">카테고리</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <input placeholder="항목명" value={itemName} onChange={(e) => setItemName(e.target.value)}
                style={{ flex: "2 1 100px", minWidth: 80, padding: "7px 8px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }} />
              <input type="number" placeholder="금액" value={amount} onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                style={{ flex: "1 1 80px", minWidth: 70, padding: "7px 8px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12, textAlign: "right" }} />
              <Btn onClick={handleAdd} style={{ padding: "7px 14px" }}>+ 추가</Btn>
            </div>
          )}
        </Card>
      )}

      {/* 시즌 요약 */}
      {seasonSummary.roundCount > 0 && (
        <Card title="📊 시즌 지출 요약" badge={`${seasonSummary.roundCount}R`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            <div style={{ textAlign: "center", padding: 10, background: C.sf, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: C.dim }}>시즌 총 지출</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{fmtW(seasonSummary.totalAll)}</div>
            </div>
            <div style={{ textAlign: "center", padding: 10, background: C.sf, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: C.dim }}>라운드 평균</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fmtW(seasonSummary.avgPerRound)}</div>
            </div>
          </div>

          {/* 카테고리별 막대 차트 */}
          <div style={{ fontSize: 11, fontWeight: 600, color: C.mid, marginBottom: 6 }}>카테고리별 지출</div>
          {EXPENSE_CATEGORIES.map((cat) => {
            const val = seasonSummary.byCat[cat.id] || 0;
            if (val === 0) return null;
            return (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14, minWidth: 20 }}>{cat.icon}</span>
                <span style={{ fontSize: 10, color: C.mid, minWidth: 36 }}>{cat.label}</span>
                <div style={{ flex: 1, height: 10, background: C.sf, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: `${(val / seasonSummary.maxCat) * 100}%`, height: "100%", background: C.accent, borderRadius: 5 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, minWidth: 60, textAlign: "right" }}>{fmtW(val)}</span>
              </div>
            );
          })}

          {/* 라운드별 인당 금액 */}
          <div style={{ fontSize: 11, fontWeight: 600, color: C.mid, marginTop: 14, marginBottom: 6 }}>라운드별 인당 금액</div>
          {[...seasonSummary.perRound].reverse().map((r) => {
            const ok = r.perPerson >= EXPENSE_TARGET_MIN && r.perPerson <= EXPENSE_TARGET_MAX;
            const color = r.perPerson === 0 ? C.dim : ok ? C.accent : C.warn;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
                <span style={{ color: C.dim, minWidth: 30 }}>R{r.id}</span>
                <span style={{ color: C.mid, minWidth: 70 }}>{r.date}</span>
                <span style={{ flex: 1 }}></span>
                <span style={{ fontSize: 10, color: C.dim }}>{r.count}명</span>
                <span style={{ fontWeight: 600, color, minWidth: 70, textAlign: "right" }}>{fmtW(r.perPerson)}</span>
                <span style={{ fontSize: 10, color, minWidth: 30 }}>{r.perPerson === 0 ? "" : ok ? "✓" : "⚠"}</span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ═══ RULES SUMMARY ═══
function Rules() {
  const rules = [
    { id: "제1조", title: "ㄱㅈㅂ 모자", desc: "월례회 꼴찌가 보유. 26년부터 노핸디." },
    { id: "제5조", title: "멀리건 혜택", desc: "모자 착용 시 원하는 홀에서 멀리건 1회." },
    { id: "제6조", title: "동기부여", desc: "인당 150만원 회비. 목표타수 달성 시 50만원 수령." },
    { id: "제7조", title: "인원구성", desc: "탈퇴 자유, 단 목표 미달성 시 납입금 불가." },
    { id: "제9조", title: "월례회", desc: "매월 셋째 화요일 오후 태광CC. 회비 150만원." },
    { id: "제10조", title: "출석", desc: "3~6, 8~11월 총 8회 중 5회 이상 참석 필수." },
    { id: "제11조", title: "F1 포인트", desc: "1위 25 / 2위 18 / 3위 15 / 4위 12 / 5위 10 / 6위 8pts. 연말 합산." },
    { id: "제12조", title: "카트배", desc: "전월 핸디별 카트 밸런스 편성. 카트 1,2등 포상." },
    { id: "제13조", title: "챔피언", desc: "연말 포인트 1위 = 챔피언 모자. 챔피언이 다음해 총무." },
    { id: "제14조", title: "기타 상품", desc: "롱기, 니어, 행운상 등 회비 고려 적정 포상." },
    { id: "게임룰", title: "게임룰", desc: "NO멀리건 / OB말뚝=죽음 / 자연장애물 빼기 1벌타 / 컨시드=홀컵+먹갈치 / 클럽 14개" },
  ];
  return (
    <Card title="📜 ㄱㅈㅂ GOLF 정관 요약 (251119 기준)">
      {rules.map((r) => (
        <div key={r.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, minWidth: 44 }}>{r.id}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{r.title}</span>
          </div>
          <p style={{ margin: "3px 0 0 52px", fontSize: 11, color: C.mid, lineHeight: 1.5 }}>{r.desc}</p>
        </div>
      ))}
      <div style={{ marginTop: 12, padding: 10, background: C.sf, borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 6 }}>🎯 2026년 목표타수</div>
        <div style={{ fontSize: 10, color: C.mid, lineHeight: 1.8 }}>
          문민구 75이하 / 조동훈·이민규 80이하 / 이희진·최영근·홍석환·최성현·김산·강석훈 85이하 / 박시환·박인혁 90미만 / 송영섭·장주홍·정승윤 95미만
        </div>
      </div>
    </Card>
  );
}
