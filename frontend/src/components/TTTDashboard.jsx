import { useState, useEffect } from "react";
import { getEntries } from "../tttApi";

const PROJECT_COLORS = [
  "#2563eb", "#7c3aed", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#db2777", "#65a30d",
];

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div style={{
      background: accent ? "var(--accent)" : "var(--bg)",
      border: `1px solid ${accent ? "transparent" : "var(--border)"}`,
      borderRadius: 10,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}>
      <div style={{
        fontSize: 26,
        fontWeight: 700,
        color: accent ? "#fff" : "var(--text)",
        letterSpacing: "-0.5px",
        lineHeight: 1.1,
      }}>{value}</div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: accent ? "rgba(255,255,255,0.85)" : "var(--text)",
        marginTop: 4,
      }}>{label}</div>
      {sub && (
        <div style={{
          fontSize: 11,
          color: accent ? "rgba(255,255,255,0.6)" : "var(--muted)",
          marginTop: 1,
        }}>{sub}</div>
      )}
    </div>
  );
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(d) {
  if (!d) return "";
  const [y, mo, day] = d.split("T")[0].split("-").map(Number);
  return new Date(y, mo - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TaskTypePill({ type }) {
  const map = {
    meeting:  { bg: "#eff6ff", color: "#1d4ed8" },
    focus:    { bg: "#f0fdf4", color: "#15803d" },
    review:   { bg: "#fdf4ff", color: "#7e22ce" },
    admin:    { bg: "#fff7ed", color: "#c2410c" },
  };
  const style = map[type] || { bg: "var(--surface)", color: "var(--muted)" };
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: "1px 6px",
      borderRadius: 4,
      textTransform: "uppercase",
      letterSpacing: "0.4px",
      background: style.bg,
      color: style.color,
    }}>{type}</span>
  );
}

export default function TTTDashboard({ token }) {
  const [summary, setSummary]   = useState(null);
  const [recent,  setRecent]    = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const entries = await getEntries({}, token);
        setRecent(entries.slice(0, 8));

        const now   = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const end   = now.toISOString().split("T")[0];
        const monthEntries = entries.filter(e => e.date >= start && e.date <= end);
        const totalMin    = monthEntries.reduce((s, e) => s + e.durationMinutes, 0);
        const billableMin = monthEntries.filter(e => e.billable).reduce((s, e) => s + e.durationMinutes, 0);
        const projects    = [...new Set(monthEntries.map(e => e.projectCode))];
        const byProject   = Object.entries(
          monthEntries.reduce((acc, e) => {
            acc[e.projectCode] = (acc[e.projectCode] || 0) + e.durationMinutes;
            return acc;
          }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .map(([project, mins]) => ({ project, hours: mins / 60 }));

        setSummary({
          totalHours:    totalMin / 60,
          billableHours: billableMin / 60,
          totalEntries:  monthEntries.length,
          projectCount:  projects.length,
          byProject,
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) return <div className="card"><p className="loading">Loading dashboard…</p></div>;
  if (error)   return <div className="card"><p style={{ color: "var(--danger)" }}>{error}</p></div>;

  const maxHours = summary.byProject[0]?.hours || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatCard accent label="Hours this month" value={summary.totalHours.toFixed(1)} sub="billable + non-billable" />
        <StatCard label="Billable hours"   value={summary.billableHours.toFixed(1)} sub="this month" />
        <StatCard label="Total entries"    value={summary.totalEntries} sub="this month" />
        <StatCard label="Active projects"  value={summary.projectCount} sub="this month" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Recent entries */}
        <div className="card" style={{ padding: "20px 22px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 14 }}>
            Recent Entries
          </div>
          {recent.length === 0
            ? <p className="empty">No entries yet.</p>
            : recent.map((e, i) => (
              <div key={e.id} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 0",
                borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none",
                gap: 10,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {e.meetingTitle || "Untitled"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{e.projectCode}</span>
                    <span style={{ fontSize: 10, color: "var(--border)" }}>·</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatDate(e.date)}</span>
                    <TaskTypePill type={e.taskType} />
                  </div>
                </div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text)",
                  background: "var(--surface)",
                  padding: "2px 8px",
                  borderRadius: 5,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                  {formatDuration(e.durationMinutes)}
                </div>
              </div>
            ))
          }
        </div>

        {/* Hours by project */}
        <div className="card" style={{ padding: "20px 22px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 14 }}>
            Hours by Project
          </div>
          {summary.byProject.length === 0
            ? <p className="empty">No data yet.</p>
            : summary.byProject.slice(0, 8).map((p, i) => (
              <div key={p.project} style={{ marginBottom: i < summary.byProject.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{p.project}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{p.hours.toFixed(1)}h</span>
                </div>
                <div style={{ height: 4, background: "var(--surface)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(p.hours / maxHours) * 100}%`,
                    background: PROJECT_COLORS[i % PROJECT_COLORS.length],
                    borderRadius: 2,
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
