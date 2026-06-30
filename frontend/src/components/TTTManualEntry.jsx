import { useState, useEffect } from "react";
import { createEntry, classifyMeeting, getProjects } from "../tttApi";

const TASK_TYPES = ["meeting","development","planning","review","admin","learning","other"];

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
        projectCode:     form.project,
        taskType:        form.taskType,
        billable:        form.billable,
        description:     form.description,
        organizer:       form.organizer || null,
        attendees:       form.attendees || null,
        startTime:       form.startTime ? `${form.date}T${form.startTime}:00Z` : null,
        endTime:         form.endTime   ? `${form.date}T${form.endTime}:00Z`   : null,
        confidence:      0.75,
        status:          "logged",
      }, token);
      setSuccess(true);
      setForm(f => ({ ...f, title: "", description: "", organizer: "", attendees: "", startTime: "", endTime: "", duration: "" }));
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="card">
      <h2 className="section-title">Add Manual Time Entry</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label className="filter-label">Date *</label>
            <input type="date" className="input" value={form.date} onChange={e => set("date", e.target.value)} required />
          </div>
          <div>
            <label className="filter-label">Start time</label>
            <input type="time" className="input" value={form.startTime}
              onChange={e => { set("startTime", e.target.value); calcDuration(e.target.value, form.endTime); }} />
          </div>
          <div>
            <label className="filter-label">End time</label>
            <input type="time" className="input" value={form.endTime}
              onChange={e => { set("endTime", e.target.value); calcDuration(form.startTime, e.target.value); }} />
          </div>
          <div>
            <label className="filter-label">Duration (hrs) *</label>
            <input type="number" className="input" step="0.25" min="0.25" value={form.duration}
              onChange={e => set("duration", e.target.value)} required />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="filter-label">Meeting / Task title *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" className="input" value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="e.g., Sprint Planning Meeting" required />
            <button type="button" className="btn btn-outline" style={{ whiteSpace: "nowrap" }} onClick={handleClassify}>
              Auto-classify
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
          <div>
            <label className="filter-label">Project *</label>
            <input type="text" className="input" list="ttt-projects" value={form.project}
              onChange={e => set("project", e.target.value)} placeholder="e.g., Honda" required />
            <datalist id="ttt-projects">
              {projects.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div>
            <label className="filter-label">Task type</label>
            <select className="select" value={form.taskType} onChange={e => set("taskType", e.target.value)}>
              {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="filter-label">Billable</label>
            <select className="select" value={form.billable ? "true" : "false"}
              onChange={e => set("billable", e.target.value === "true")}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="filter-label">Description</label>
          <textarea className="input" rows={3} value={form.description}
            onChange={e => set("description", e.target.value)} placeholder="Additional notes…" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div>
            <label className="filter-label">Organizer</label>
            <input type="email" className="input" value={form.organizer}
              onChange={e => set("organizer", e.target.value)} placeholder="organizer@company.com" />
          </div>
          <div>
            <label className="filter-label">Attendees</label>
            <input type="text" className="input" value={form.attendees}
              onChange={e => set("attendees", e.target.value)} placeholder="Comma-separated" />
          </div>
        </div>

        {error   && <p style={{ color: "var(--danger)", marginTop: 10, fontSize: 13 }}>{error}</p>}
        {success && <p style={{ color: "var(--success)", marginTop: 10, fontSize: 13 }}>Entry saved successfully.</p>}

        <div className="upload-actions" style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Entry"}
          </button>
          <button type="reset" className="btn btn-outline" onClick={() => { setSuccess(false); setError(null); }}>
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
