import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useLocation } from "react-router-dom";
import "./Menu.css";

const menuItems = [
  { label: "Overview", path: "/summary", icon: "◫" },
  { label: "Orders", path: "/orders", icon: "⇄" },
  { label: "Holdings", path: "/holdings", icon: "▤" },
  { label: "Positions", path: "/positions", icon: "⌁" },
  { label: "Funds", path: "/funds", icon: "₹" },
  { label: "Tools", path: "/apps", icon: "⌘" },
  { label: "Insights", path: "/research", icon: "⌁" },
  { label: "AI Assistant", path: "/assistant", icon: "✧" },
];

const Menu = () => {
  const apiUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("tradeflow-theme") || "light"; }
    catch { return "light"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("tradeflow-theme", theme); } catch { /* storage may be disabled */ }
  }, [theme]);

  useEffect(() => {
    let alive = true;
    axios.get(`${apiUrl}/me`, { withCredentials: true })
      .then((res) => { if (alive) setUser(res.data.user || null); })
      .catch(() => { if (alive) setUser(null); });
    return () => { alive = false; };
  }, [apiUrl]);

  const handleLogout = async () => {
    try {
      await axios.post(`${apiUrl}/logout`, {}, { withCredentials: true });
      localStorage.removeItem("user");
      window.location.href = `${window.location.protocol}//${window.location.hostname}:3001/login`;
    } catch {
      setProfileOpen(false);
      window.alert("Logout failed. Please try again.");
    }
  };

  return (
    <div className="app-nav">
      <Link className="brand-lockup" to="/summary" aria-label="TradeFlow overview">
        <span className="brand-mark">T<span>F</span></span>
        <span className="brand-copy"><strong>tradeflow</strong><small>MARKET STUDIO</small></span>
      </Link>

      <nav className="nav-links" aria-label="Main navigation">
        {menuItems.map((item) => {
          const active = location.pathname === item.path || (item.path === "/summary" && location.pathname === "/");
          return (
            <Link key={item.path} to={item.path} className={`nav-link${active ? " active" : ""}`}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="nav-actions">
        <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} title="Toggle appearance">
          <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span className="theme-label">{theme === "light" ? "Dark" : "Light"}</span>
        </button>
        <div className="profile-wrap">
          <button className="profile-trigger" type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
            <span className="avatar">{user?.name ? user.name.charAt(0).toUpperCase() : "T"}</span>
            <span className="profile-name">{user?.name || "Trader"}</span>
            <span className="profile-caret">⌄</span>
          </button>
          {profileOpen && <div className="profile-dropdown"><span className="dropdown-user">Signed in as<br /><strong>{user?.name || "Trader"}</strong></span><button type="button" onClick={handleLogout}>Log out <span>↗</span></button></div>}
        </div>
      </div>
    </div>
  );
};

export default Menu;
