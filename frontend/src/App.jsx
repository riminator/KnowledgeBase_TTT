import { useState } from "react";
import Upload from "./components/Upload";
import Search from "./components/Search";
import Sources from "./components/Sources";
import Chat from "./components/Chat";
import MeetingUpload from "./components/MeetingUpload";
import LoginPage from "./components/LoginPage";
import TTTDashboard from "./components/TTTDashboard";
import TTTEntries from "./components/TTTEntries";
import TTTManualEntry from "./components/TTTManualEntry";
import TTTImport from "./components/TTTImport";
import TTTReports from "./components/TTTReports";
import { useSession, useAccessToken } from "./context/AuthContext";
import { supabase } from "./supabaseClient";
import "./App.css";

const KB_TABS  = ["Chat", "Search", "Upload", "Meeting", "Sources"];
const TTT_TABS = ["Dashboard", "Time Entries", "Manual Entry", "Import", "Reports"];

export default function App() {
  const [tab, setTab] = useState("Chat");
  const session = useSession();
  const token   = useAccessToken();

  if (session === undefined) return <div className="app-loading">Loading…</div>;
  if (!session)              return <LoginPage />;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-row1">
            <h1 className="logo">🗂 Knowledge<span>Base</span></h1>
            <nav className="tabs-kb">
              {KB_TABS.map(t => (
                <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </nav>
            <div className="user-bar">
              <span className="user-email">{session.user.email}</span>
              <button className="logout-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
            </div>
          </div>
          <div className="header-row2">
            <nav className="tabs-ttt">
              {TTT_TABS.map(t => (
                <button key={t} className={`tab-btn ttt-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="main">
        {tab === "Chat"         && <Chat         token={token} />}
        {tab === "Search"       && <Search       token={token} />}
        {tab === "Upload"       && <Upload       token={token} />}
        {tab === "Meeting"      && <MeetingUpload token={token} />}
        {tab === "Sources"      && <Sources      token={token} />}
        {tab === "Dashboard"    && <TTTDashboard token={token} />}
        {tab === "Time Entries" && <TTTEntries   token={token} />}
        {tab === "Manual Entry" && <TTTManualEntry token={token} />}
        {tab === "Import"       && <TTTImport    token={token} />}
        {tab === "Reports"      && <TTTReports   token={token} />}
      </main>
    </div>
  );
}
