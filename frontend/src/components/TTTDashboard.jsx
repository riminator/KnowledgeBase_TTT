import { useState, useEffect } from "react";
import { getSummary, getEntries } from "../tttApi";

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "20px 16px" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
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
  return new Date(y, mo - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
        const now   = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const end   = now.toISOString().split("T")[0];
        const [s, entries] = await Promise.all([
          getSummary({ startDate: start, endDate: end }, token),
          getEntries({}, token),
        ]);
        setSummary(s);
        setRecent(entries.slice(0, 8));
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

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label="Hours this month" value={summary.totalHours.toFixed(1)} sub="billable + non-billable" />
        <StatCard label="Billable hours"   value={summary.billableHours.toFixed(1)} sub="this month" />
        <StatCard label="Total entries"    value={summary.totalEntries} sub="this month" />
        <StatCard label="Active projects"  value={summary.projectCount} sub="this month" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Recent entries */}
        <div className="card">
          <h3 className="section-title" style={{ fontSize: 14, marginBottom: 12 }}>Recent Entries</h3>
          {recent.length === 0
            ? <p className="empty">No entries yet.</p>
            : recent.map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.meetingTitle || "Untitled"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{e.projectCode} · {formatDate(e.date)} · {e.taskType}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", marginLeft: 8 }}>
                  {formatDuration(e.durationMinutes)}
                </div>
              </div>
            ))
          }
        </div>

        {/* Hours by project */}
        <div className="card">
          <h3 className="section-title" style={{ fontSize: 14, marginBottom: 12 }}>Hours by Project</h3>
          {summary.byProject.length === 0
            ? <p className="empty">No data yet.</p>
            : summary.byProject.slice(0, 8).map(p => (
              <div key={p.project} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13 }}>{p.project}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{p.hours.toFixed(1)}h</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
