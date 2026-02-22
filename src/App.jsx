import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "gjb-golf-league-v3";

// ═══ MEMBERS & RULES from 정관(251119) ═══
const INITIAL_MEMBERS = [
  { id: 1, name: "이희진", target: 85, nextTarget: 80 },
  { id: 2, name: "최영근", target: 85, nextTarget: 80 },
  { id: 3, name: "홍석환", target: 85, nextTarget: 80 },
  { id: 4, name: "조동훈", target: 80, nextTarget: 75 },
  { id: 5, name: "최성현", target: 85, nextTarget: 80 },
  { id: 6, name: "박시환", target: 90, nextTarget: 95 },
  { id: 7, name: "박인혁", target: 90, nextTarget: 85 },
  { id: 8, name: "문민구", target: 75, nextTarget: null },
  { id: 9, name: "김산", target: 85, nextTarget: 80 },
  { id: 10, name: "이민규", target: 80, nextTarget: 75 },
  { id: 11, name: "강석훈", target: 85, nextTarget: 80 },
  { id: 12, name: "송영섭", target: 95, nextTarget: 90 },
  { id: 13, name: "장주홍", target: 95, nextTarget: 90 },
  { id: 14, name: "정승윤", target: 95, nextTarget: 90 },
];

const F1 = [
  { rank: 1, pts: 25 }, { rank: 2, pts: 18 }, { rank: 3, pts: 15 },
  { rank: 4, pts: 12 }, { rank: 5, pts: 10 }, { rank: 6, pts: 8 },
];
const getPts = (r) => F1.find((f) => f.rank === r)?.pts || 0;

// 월례회 months (제10조)
const ACTIVE_MONTHS = [3, 4, 5, 6, 8, 9, 10, 11];
const REQUIRED_ATTENDANCE = 5;
const DUES = 1500000; // 150만원
const GOAL_REFUND = 500000; // 50만원

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

const defaultData = () => ({
  members: INITIAL_MEMBERS.map((m) => ({ ...m, active: true, duesPaid: false, goalAchieved: false })),
  rounds: [],
  hatHolder: null, hatSince: null,
  season: 2026, nextRoundId: 1, nextMemberId: 15,
});

const TABS = [
  { id: "standings", label: "챔피언십", icon: "🏆" },
  { id: "round", label: "월례회", icon: "⛳" },
  { id: "hat", label: "모자", icon: "🧢" },
  { id: "attend", label: "출석", icon: "📋" },
  { id: "dues", label: "회비", icon: "💰" },
  { id: "members", label: "멤버", icon: "👥" },
  { id: "rules", label: "정관", icon: "📜" },
];

// ═══ MAIN APP ═══
export default function App() {
  const [data, setData] = useState(defaultData);
  const [tab, setTab] = useState("standings");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setData(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data, ready]);

  const up = useCallback((fn) => setData((p) => { const n = JSON.parse(JSON.stringify(p)); fn(n); return n; }), []);

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

  // Attendance calc
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

  if (!ready) return <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontFamily: "'Outfit', sans-serif" }}>로딩 중...</div>;

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
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.5 }}>ㄱㅈㅂ <span style={{ color: C.accent }}>GOLF LEAGUE</span></h1>
            <p style={{ margin: 0, fontSize: 10, color: C.dim, letterSpacing: 1 }}>{data.season} SEASON · F1 CHAMPIONSHIP · 매월 셋째 화 태광CC</p>
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
        {tab === "round" && <RoundMgr data={data} up={up} mm={mm} />}
        {tab === "hat" && <HatTracker data={data} up={up} mm={mm} />}
        {tab === "attend" && <Attendance data={data} mm={mm} attendance={attendance} />}
        {tab === "dues" && <Dues data={data} up={up} mm={mm} />}
        {tab === "members" && <MembersMgr data={data} up={up} mm={mm} />}
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

      {/* Point bars */}
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
function RoundMgr({ data, up, mm }) {
  const [date, setDate] = useState(""); const [course, setCourse] = useState("태광CC");
  const [sel, setSel] = useState([]); const [scores, setScores] = useState({});
  const [awards, setAwards] = useState([]); const [awName, setAwName] = useState(""); const [awWinner, setAwWinner] = useState("");
  const [step, setStep] = useState(1);
  const [cartTeams, setCartTeams] = useState([]);

  const active = data.members.filter((m) => m.active);
  const toggle = (id) => setSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // Cart team assignment: balance by avg score, 4 per cart
  const makeCartTeams = () => {
    if (sel.length < 4) return;
    const sorted = sel.map((id) => ({ id, avg: mm[id]?.avg || 100 })).sort((a, b) => a.avg - b.avg);
    const numCarts = Math.ceil(sorted.length / 4);
    const carts = Array.from({ length: numCarts }, () => []);
    // Snake draft
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

  // Hat goes to worst scorer (no handicap from 2026)
  const worstScorer = rankPreview.length > 0 ? rankPreview[rankPreview.length - 1] : null;

  const addAward = () => {
    if (!awName.trim()) return;
    setAwards((p) => [...p, { name: awName.trim(), winner: awWinner }]);
    setAwName(""); setAwWinner("");
  };

  const save = () => {
    if (!date) return alert("날짜를 입력하세요");
    if (sel.length === 0) return alert("참석자를 선택하세요");
    const scoreArr = Object.entries(scores).filter(([_, v]) => v && Number(v) > 0).map(([id, v]) => ({ id: Number(id), score: Number(v) }));
    up((d) => {
      d.rounds.push({ id: d.nextRoundId++, date, course, attendees: sel, scores: scoreArr, cartTeams, awards: [...awards] });
      // Update hat holder
      if (worstScorer) { d.hatHolder = worstScorer.id; d.hatSince = date; }
    });
    setStep(1); setDate(""); setCourse("태광CC"); setSel([]); setScores({}); setCartTeams([]); setAwards([]);
    alert("✅ 월례회가 저장되었습니다!");
  };

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
        <Card title="🏆 상품 기록 (제14조)" badge="롱기/니어/행운상 등">
          <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
            <select value={awName} onChange={(e) => setAwName(e.target.value)} style={{ flex: 1, padding: "7px 8px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }}>
              <option value="">상품 종류</option>
              <option>롱기스트</option><option>니어핀</option><option>이글</option><option>행운상</option><option>카트배 1등</option><option>카트배 2등</option><option>기타</option>
            </select>
            <select value={awWinner} onChange={(e) => setAwWinner(e.target.value)} style={{ flex: 1, padding: "7px 8px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }}>
              <option value="">수상자</option>
              {sel.map((id) => <option key={id} value={mm[id]?.name}>{mm[id]?.name}</option>)}
            </select>
            <Btn onClick={addAward} style={{ padding: "7px 12px" }}>+</Btn>
          </div>
          {awards.map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
              <span>{a.name} — {a.winner || "미정"}</span>
              <button onClick={() => setAwards((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </Card>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <Btn ghost color={C.mid} onClick={() => setStep(2)} style={{ flex: 1 }}>← 이전</Btn>
          <Btn onClick={save} style={{ flex: 2, padding: 12, fontSize: 14 }}>✅ 월례회 저장</Btn>
        </div>

        {/* Past rounds */}
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
      </>)}
    </div>
  );
}

// ═══ HAT TRACKER ═══
function HatTracker({ data, up, mm }) {
  const holder = data.hatHolder ? mm[data.hatHolder] : null;
  const since = data.hatSince;
  const days = since ? Math.floor((new Date() - new Date(since)) / 86400000) : 0;

  // Hat history from rounds
  const hatHistory = useMemo(() => {
    return data.rounds.filter((r) => r.scores?.length > 0).map((r) => {
      const sorted = [...r.scores].sort((a, b) => a.score - b.score);
      const worst = sorted[sorted.length - 1];
      return { roundId: r.id, date: r.date, holderId: worst.id, score: worst.score };
    });
  }, [data]);

  // Count per member
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
function Dues({ data, up, mm }) {
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
                <button onClick={() => up((d) => { const x = d.members.find((y) => y.id === m.id); if (x) x.duesPaid = !x.duesPaid; })}
                  style={{ padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: m.duesPaid ? C.accentDim : C.redDim, color: m.duesPaid ? C.accent : C.red }}>
                  {m.duesPaid ? "납입✓" : "미납"}
                </button>
                <button onClick={() => up((d) => { const x = d.members.find((y) => y.id === m.id); if (x) x.goalAchieved = !x.goalAchieved; })}
                  style={{ padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: m.goalAchieved ? C.gold + "20" : C.sf, color: m.goalAchieved ? C.gold : C.dim }}>
                  {m.goalAchieved ? "달성🎉" : "미달성"}
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ═══ MEMBERS ═══
function MembersMgr({ data, up, mm }) {
  const [name, setName] = useState(""); const [tgt, setTgt] = useState("");
  const [editId, setEditId] = useState(null); const [editTgt, setEditTgt] = useState("");
  const saveTarget = (id) => {
    const v = Number(editTgt);
    if (v > 0) up((d) => { const x = d.members.find((y) => y.id === id); if (x) x.target = v; });
    setEditId(null);
  };
  const add = () => {
    if (!name.trim()) return;
    up((d) => { d.members.push({ id: d.nextMemberId++, name: name.trim(), target: tgt ? Number(tgt) : 95, nextTarget: null, active: true, duesPaid: false, goalAchieved: false }); });
    setName(""); setTgt("");
  };
  return (
    <div>
      <Card title="👥 멤버 추가 (제7,8조: 80% 찬성 필요)">
        <div style={{ display: "flex", gap: 6 }}>
          <input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            style={{ flex: 2, padding: "8px 10px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }} />
          <input placeholder="목표타수" type="number" value={tgt} onChange={(e) => setTgt(e.target.value)}
            style={{ flex: 1, padding: "8px 10px", background: C.sf, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12 }} />
          <Btn onClick={add}>추가</Btn>
        </div>
      </Card>
      <Card title={`멤버 목록`} badge={`${data.members.length}명`}>
        {data.members.map((m) => {
          const info = mm[m.id];
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", borderRadius: 8, marginBottom: 4, background: m.active ? C.sf : C.bg, border: `1px solid ${m.active ? C.border : C.bg}`, opacity: m.active ? 1 : .4 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{m.name}</span>
                {editId === m.id ? (
                  <input type="number" value={editTgt} autoFocus onChange={(e) => setEditTgt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveTarget(m.id); if (e.key === "Escape") setEditId(null); }}
                    onBlur={() => saveTarget(m.id)}
                    style={{ marginLeft: 6, width: 50, padding: "2px 6px", background: C.card, border: `1px solid ${C.accent}`, borderRadius: 5, color: C.text, fontSize: 10, textAlign: "center" }} />
                ) : (
                  <span style={{ marginLeft: 6, fontSize: 10, color: C.dim, cursor: "pointer", borderBottom: `1px dashed ${C.dim}` }}
                    onClick={() => { setEditId(m.id); setEditTgt(String(m.target)); }}>목표 {m.target}타</span>
                )}
                {info?.avg && <span style={{ marginLeft: 6, fontSize: 10, color: C.mid }}>avg {info.avg} · {info.played}R</span>}
                {info?.bestScore && <span style={{ marginLeft: 6, fontSize: 10, color: C.accent }}>best {info.bestScore}</span>}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <Btn ghost color={m.active ? C.accent : C.dim} onClick={() => up((d) => { const x = d.members.find((y) => y.id === m.id); if (x) x.active = !x.active; })} style={{ padding: "3px 8px", fontSize: 10 }}>{m.active ? "활동" : "휴면"}</Btn>
              </div>
            </div>
          );
        })}
      </Card>
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
