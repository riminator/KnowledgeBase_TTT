import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { importCSV, importICS } from "../tttApi";

function ImportZone({ accept, label, hint, onImport, token }) {
  const [status,  setStatus]  = useState("idle");
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [file,    setFile]    = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept,
    onDrop: (files) => files[0] && setFile(files[0]),
  });

  async function handleImport() {
    if (!file) return;
    setStatus("loading"); setError(null); setResult(null);
    try {
      const res = await onImport(file, token);
      setResult(res);
      setStatus("done");
      setFile(null);
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }

  return (
    <div className="card">
      <h3 className="section-title" style={{ fontSize: 14 }}>{label}</h3>
      <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`} style={{ marginBottom: 12 }}>
        <input {...getInputProps()} />
        {file
          ? <><div className="dropzone-icon">📄</div><div style={{ fontWeight: 600 }}>{file.name}</div><div className="dropzone-hint">Click to replace</div></>
          : <><div className="dropzone-icon">📁</div><div>{isDragActive ? "Drop here…" : "Drag & drop or click to select"}</div><div className="dropzone-hint">{hint}</div></>
        }
      </div>
      <button className="btn btn-primary" onClick={handleImport} disabled={!file || status === "loading"}>
        {status === "loading" ? "Importing…" : "Import"}
      </button>
      {result && (
        <p style={{ color: "var(--success)", marginTop: 8, fontSize: 13 }}>
          ✓ Imported {result.count} {result.count === 1 ? "entry" : "entries"}{result.failed ? ` (${result.failed} failed)` : ""}.
        </p>
      )}
      {error && <p style={{ color: "var(--danger)", marginTop: 8, fontSize: 13 }}>{error}</p>}
    </div>
  );
}

export default function TTTImport({ token }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <ImportZone
          label="📊 Import from CSV / Excel"
          hint="CSV with Date, Project, Title, Duration columns"
          accept={{ "text/csv": [".csv"], "application/vnd.ms-excel": [".xls","xlsx"] }}
          onImport={importCSV}
          token={token}
        />
        <ImportZone
          label="📅 Import from Calendar (ICS)"
          hint=".ics file from Outlook, Google Calendar, Apple Calendar"
          accept={{ "text/calendar": [".ics"] }}
          onImport={importICS}
          token={token}
        />
      </div>

      <div className="card">
        <h3 className="section-title" style={{ fontSize: 14 }}>Import Format Reference</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>CSV / Excel</p>
            <ul style={{ fontSize: 13, paddingLeft: 16, color: "var(--muted)", lineHeight: 1.8 }}>
              <li>Row 1 must be column headers</li>
              <li>Date: YYYY-MM-DD or M/D/YY</li>
              <li>Duration: decimal hours (1.5 = 90 min)</li>
              <li>Columns: Date, Project / Client Name, Meeting/Project Title, Duration (hrs), Start Time, End Time, Notes</li>
            </ul>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Calendar ICS</p>
            <ul style={{ fontSize: 13, paddingLeft: 16, color: "var(--muted)", lineHeight: 1.8 }}>
              <li><strong>Outlook:</strong> File → Save Calendar → .ics</li>
              <li><strong>Google:</strong> Settings → Import &amp; Export → Export</li>
              <li><strong>Apple:</strong> File → Export → Export</li>
              <li>Meetings are auto-classified by title</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
