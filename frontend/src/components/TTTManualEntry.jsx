import { useState, useEffect } from "react";
import { createEntry, classifyMeeting, getProjects } from "../tttApi";

const TASK_TYPES = ["meeting","development","planning","review","admin","learning","other"];

function Field({ label, required, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}{required && " *"}
      </label>
      {children}
    </div>
  );
}

export default function TTTManualEntry({ token }) {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    date:        new Date().toISOString().split("T")[0],
    startTime:   "",
    endTime:     "",
    duration:    "",
    title:       "",
    project:     "",
    taskType:    "meeting",
    billable:    false,
    description: "",
    organizer:   "",
    attendees:   "",
  });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    getProjects(token).then(setProjects).catch(() => {});
  }, [token]);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function calcDuration(start, end) {
    if (!start || !end) return;
    const s = new Date(`2000-01-01T${start}`);
    const e = new Date(`2000-01-01T${end}`);
    const hrs = (e - s) / 3600000;
    if (hrs > 0) set("duration", hrs.toFixed(2));
  }

  async function handleClassify() {
    if (!form.title) { setError("Enter a title first."); return; }
    setError(null);
    try {
      const cl = await classifyMeeting(form.title, form.organizer || null, token);
      setForm(f => ({ ...f, project: cl.projectCode, taskType: cl.taskType, billable: cl.billable }));
    } catch (e) { setError(e.message); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null); setSuccess(false);
    try {
      await createEntry({
        date:            form.date,
        durationMinutes: parseFloat(form.duration) * 60,
        meetingTitle:    form.title,
        projectCode:     form.project || "GENERAL",
        taskType:        form.taskType,
        billable:        form.billable,
        description:     form.description || null,
        organizer:       form.organizer   || null,
        attendees:       form.attendees   || null,
        startTime:       form.startTime ? `${form.date}T${form.startTime}:00Z` : null,
        endTime:         form.endTime   ? `${form.date}T${form.endTime}:00Z`   : null,
        confidence:      0.75,
        status:          "logged",
      }, token);
      setSuccess(true);
      setForm(f => ({ ...f, title: "", description: "", organizer: "", attendees: "", startTime: "", endTime: "", duration: "", project: "" }));
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const row = { display: "grid", gap: 12 };

  return (
    <div className="card" style={{ maxWidth: 700 }}>
      <h2 className="section-title">Add Manual Time Entry</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Row 1 — date + times + duration */}
        <div style={{ ...row, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <Field label="Date" required>
            <input type="date" className="input" value={form.date}
              onChange={e => set("date", e.target.value)} required />
          </Field>
          <Field label="Start time">
            <input type="time" className="input" value={form.startTime}
              onChange={e => { set("startTime", e.target.value); calcDuration(e.target.value, form.endTime); }} />
          </Field>
          <Field label="End time">
            <input type="time" className="input" value={form.endTime}
              onChange={e => { set("endTime", e.target.value); calcDuration(form.startTime, e.target.value); }} />
          </Field>
          <Field label="Duration (hrs)" required>
            <input type="number" className="input" step="0.25" min="0.25" value={form.duration}
              onChange={e => set("duration", e.target.value)} required />
          </Field>
        </div>

        {/* Row 2 — title + classify */}
        <Field label="Meeting / Task title" required>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" className="input" value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g., Sprint Planning Meeting" required
              style={{ flex: 1 }} />
            <button type="button" className="btn btn-outline" style={{ whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={handleClassify}>
              Auto-classify
            </button>
          </div>
        </Field>

        {/* Row 3 — project + task type + billable */}
        <div style={{ ...row, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <Field label="Project" required>
            <input type="text" className="input" list="ttt-projects" value={form.project}
              onChange={e => set("project", e.target.value)} placeholder="e.g., Honda" required />
            <datalist id="ttt-projects">
              {projects.map(p => <option key={p} value={p} />)}
            </datalist>
          </Field>
          <Field label="Task type">
            <select className="select" value={form.taskType} onChange={e => set("taskType", e.target.value)}>
              {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Billable">
            <select className="select" value={form.billable ? "true" : "false"}
              onChange={e => set("billable", e.target.value === "true")}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
        </div>

        {/* Row 4 — description */}
        <Field label="Description">
          <textarea className="input" rows={3} value={form.description}
            onChange={e => set("description", e.target.value)} placeholder="Additional notes…" />
        </Field>

        {/* Row 5 — organizer + attendees */}
        <div style={{ ...row, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Organizer">
            <input type="email" className="input" value={form.organizer}
              onChange={e => set("organizer", e.target.value)} placeholder="organizer@company.com" />
          </Field>
          <Field label="Attendees">
            <input type="text" className="input" value={form.attendees}
              onChange={e => set("attendees", e.target.value)} placeholder="Comma-separated" />
          </Field>
        </div>

        {error   && <p style={{ color: "var(--danger)",  fontSize: 13, margin: 0 }}>{error}</p>}
        {success && <p style={{ color: "var(--success)", fontSize: 13, margin: 0 }}>Entry saved successfully.</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Entry"}
          </button>
          <button type="button" className="btn btn-outline"
            onClick={() => { setSuccess(false); setError(null); setForm(f => ({ ...f, title: "", description: "", organizer: "", attendees: "", startTime: "", endTime: "", duration: "", project: "" })); }}>
            Reset
          </button>
        </div>

      </form>
    </div>
  );
}
