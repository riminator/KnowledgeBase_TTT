import { useState } from "react";
import { getSummary, exportCSV } from "../tttApi";

function ReportTable({ headers, rows }) {
  if (!rows || rows.length === 0) return <p className="empty">No data for this period.</p>;
  return (
    <table className="sources-table" style={{ fontSize: 13 }}>
      <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export default function TTTReports({ token }) {
  const today      = new Date().toISOString().split("T")[0];
  const firstOfMo  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstOfMo);
  const [endDate,   setEndDate]   = useState(today);
  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [exporting, setExporting] = useState(false);

  async function handleGenerate() {
    if (!startDate || !endDate) { setError("Select both dates."); return; }
    setLoading(true); setError(null);
    try {
      const data = await getSummary({ startDate, endDate }, token);
      setReport(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportCSV(token, startDate, endDate);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `time-entries-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); }
    finally { setExporting(false); }
  }

  return (
    <div>
      {/* Controls */}
      <div className="card">
        <h2 className="section-title">Time Reports</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div>
            <label className="filter-label">Start date</label>
            <input type="date" className="small-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="filter-label">End date</label>
            <input type="date" className="small-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate Report"}
          </button>
          {report && (
            <button className="btn btn-outline" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          )}
        </div>
        {error && <p style={{ color: "var(--danger)", marginTop: 8, fontSize: 13 }}>{error}</p>}
      </div>

      {report && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, margin: "12px 0" }}>
            {[
              { label: "Total hours",    value: report.totalHours.toFixed(1) },
              { label: "Billable hours", value: report.billableHours.toFixed(1) },
              { label: "Total entries",  value: report.totalEntries },
              { label: "Projects",       value: report.projectCount },
            ].map(c => (
              <div key={c.label} className="card" style={{ textAlign: "center", padding: "14px 10px" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>{c.value}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* By project */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 className="section-title" style={{ fontSize: 14, marginBottom: 10 }}>By Project</h3>
            <ReportTable
              headers={["Project", "Hours", "Entries", "%"]}
              rows={report.byProject.map(p => [
                p.project, p.hours.toFixed(1), p.count, `${p.percentage.toFixed(1)}%`,
              ])}
            />
          </div>

          {/* By day */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 className="section-title" style={{ fontSize: 14, marginBottom: 10 }}>By Day</h3>
            <ReportTable
              headers={["Date", "Hours", "Entries"]}
              rows={report.byDay.map(d => [d.date, d.hours.toFixed(1), d.count])}
            />
          </div>

          {/* By task type */}
          <div className="card">
            <h3 className="section-title" style={{ fontSize: 14, marginBottom: 10 }}>By Task Type</h3>
            <ReportTable
              headers={["Type", "Hours", "Entries", "%"]}
              rows={report.byType.map(t => [
                t.type, t.hours.toFixed(1), t.count, `${t.percentage.toFixed(1)}%`,
              ])}
            />
          </div>
        </>
      )}
    </div>
  );
}
