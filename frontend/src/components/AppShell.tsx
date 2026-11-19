import {
  Activity,
  ClipboardList,
  FileStack,
  UsersRound,
  UserRound,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { StaffRole } from "../api/types";

interface NavigationItem {
  label: string;
  to: string;
  icon: typeof ClipboardList;
  roles: StaffRole[];
}

const navigation: NavigationItem[] = [
  {
    label: "Worklist",
    to: "/app/worklist",
    icon: ClipboardList,
    roles: ["front_desk", "radiologist", "facility_admin"],
  },
  {
    label: "Patients",
    to: "/app/patients",
    icon: UsersRound,
    roles: ["front_desk", "facility_admin"],
  },
  {
    label: "Staff",
    to: "/app/staff",
    icon: UserRound,
    roles: ["facility_admin"],
  },
  {
    label: "Templates",
    to: "/app/templates",
    icon: FileStack,
    roles: ["facility_admin"],
  },
];

const roleLabels: Record<StaffRole, string> = {
  front_desk: "Front desk",
  radiologist: "Radiologist",
  facility_admin: "Facility admin",
};

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;

  const items = navigation.filter((item) => item.roles.includes(user.role));
  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : "5C";

  return (
    <div className="app-layout">
      <aside className={`sidebar${mobileOpen ? " sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <img src="/assets/5c-networks-logo.png" alt="" />
          <span>
            <strong>5C Networks</strong>
            <small>Cloud Reporting</small>
          </span>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-facility">
          <span className="facility-dot" />
          <span>{user.facilityName || "Imaging centre"}</span>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Primary navigation">
          {items.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Worklist" && <span className="nav-indicator" />}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="system-status-dot" />
            <span>Workspace active</span>
          </div>
          <div className="sidebar-user">
            <div className="avatar">{initials}</div>
            <div className="sidebar-user-copy">
              <strong>{user.email || roleLabels[user.role]}</strong>
              <span>{roleLabels[user.role]}</span>
            </div>
            <Activity size={16} className="sidebar-user-mark" />
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="topbar-breadcrumb">
            <span>5C Networks</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Reporting workspace</strong>
          </div>
          <div className="topbar-actions">
            <div className="user-role-chip">{roleLabels[user.role]}</div>
            <button
              className="button button-quiet button-small"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
    </div>
  );
}
