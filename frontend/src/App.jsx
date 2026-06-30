import { useState } from "react";
import Upload from "./components/Upload";
import Search from "./components/Search";
import Sources from "./components/Sources";
import Chat from "./components/Chat";
import MeetingUpload from "./components/MeetingUpload";
import LoginPage from "./components/LoginPage";
import { useSession, useAccessToken } from "./context/AuthContext";
import { supabase } from "./supabaseClient";
import "./App.css";

const TABS = ["Chat", "Search", "Upload", "Meeting", "Sources"];

export default function App() {
  const [tab, setTab] = useState("Chat");
  const session = useSession();
  const token = useAccessToken();

  // Still loading session from Supabase
  if (session === undefined) {
    return <div className="app-loading">Loading…</div>;
  }

  // Not logged in — show login page
  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo">🗂 Knowledge<span>Base</span></h1>
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`tab-btn ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>
          <div className="user-bar">
            <span className="user-email">{session.user.email}</span>
            <button
              className="logout-btn"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {tab === "Chat"    && <Chat token={token} />}
        {tab === "Search"  && <Search token={token} />}
        {tab === "Upload"  && <Upload token={token} />}
        {tab === "Meeting" && <MeetingUpload token={token} />}
        {tab === "Sources" && <Sources token={token} />}
      </main>
    </div>
  );
}
