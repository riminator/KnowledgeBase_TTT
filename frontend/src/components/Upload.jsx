import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { uploadFile } from "../api";

const DOC_TYPES = [
  { value: "",                   label: "Auto-detect" },
  { value: "PDF",                label: "PDF" },
  { value: "Document",           label: "Document" },
  { value: "Meeting Transcript", label: "Meeting Transcript" },
  { value: "Meeting Notes",      label: "Meeting Notes" },
  { value: "Notes",              label: "Notes" },
  { value: "Report",             label: "Report" },
  { value: "Presentation",       label: "Presentation" },
  { value: "Spreadsheet",        label: "Spreadsheet" },
  { value: "Code",               label: "Code" },
  { value: "Image",              label: "Image" },
  { value: "Reference",          label: "Reference" },
  { value: "Other",              label: "Other" },
];

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Upload({ token }) {
  const [files,       setFiles]       = useState([]);   // [{ file, status, error }]
  const [force,       setForce]       = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const [docType,     setDocType]     = useState("");

  const onDrop = useCallback((accepted) => {
    setFiles((prev) => [
      ...prev,
      ...accepted.map((f) => ({ file: f, status: "pending", error: null })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  function removeFile(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleUpload() {
    const pending = files.filter((f) => f.status === "pending");
    for (const item of pending) {
      setFiles((prev) =>
        prev.map((f) => (f.file === item.file ? { ...f, status: "uploading" } : f))
      );
      try {
        await uploadFile(item.file, force, token, {
          projectCode: projectCode.trim() || undefined,
          docType:     docType || undefined,
        });
        setFiles((prev) =>
          prev.map((f) => (f.file === item.file ? { ...f, status: "done" } : f))
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === item.file ? { ...f, status: "error", error: err.message } : f
          )
        );
      }
    }
  }

  function clearDone() {
    setFiles((prev) => prev.filter((f) => f.status !== "done"));
  }

  const hasPending = files.some((f) => f.status === "pending");

  return (
    <div>
      <div className="card">
        <h2 className="section-title">Upload Documents</h2>
        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? "active" : ""}`}
        >
          <input {...getInputProps()} />
          <div className="dropzone-icon">📂</div>
          <div>Drag & drop files here, or click to select</div>
          <div className="dropzone-hint">
            PDF, DOCX, TXT, MD, CSV, JSON, images (PNG/JPG), code files, and more
          </div>
        </div>

        {/* Metadata fields */}
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="filter-label">Project Code</label>
            <input
              type="text"
              className="small-input"
              placeholder="e.g. PROJ-001"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="filter-label">Document Type</label>
            <select
              className="select"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{ width: 200 }}
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {files.length > 0 && (
          <>
            <div className="file-queue">
              {files.map((item, i) => (
                <div key={i} className="file-item">
                  <span className={`status-dot ${item.status}`} title={item.status} />
                  <span className="name">{item.file.name}</span>
                  <span className="size">{formatBytes(item.file.size)}</span>
                  {item.status === "error" && (
                    <span style={{ color: "var(--danger)", fontSize: 12 }}>
                      {item.error}
                    </span>
                  )}
                  {item.status === "pending" && (
                    <button className="btn btn-danger" onClick={() => removeFile(i)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="upload-actions">
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!hasPending}
              >
                Upload {hasPending ? `${files.filter((f) => f.status === "pending").length} file(s)` : ""}
              </button>
              <button className="btn btn-outline" onClick={clearDone}>
                Clear done
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                />
                Re-index existing files
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
