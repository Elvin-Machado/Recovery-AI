import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">R</div>

        <div>
          <h1>RecoverAI</h1>
          <span>Revenue Intelligence</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        <NavLink to="/dashboard" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>◉</span>
          Dashboard
        </NavLink>

        <NavLink to="/transactions" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>◈</span>
          Transactions
        </NavLink>

        <NavLink to="/queue" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>↗</span>
          Recovery Queue
        </NavLink>

        <NavLink to="/customers" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>◇</span>
          Customers
        </NavLink>

        <NavLink to="/subscriptions" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>≡</span>
          Subscriptions
        </NavLink>

        <NavLink to="/receivables" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>◎</span>
          Receivables
        </NavLink>

        <NavLink to="/promises" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>○</span>
          Promises
        </NavLink>

        <NavLink to="/simulator" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>◓</span>
          Simulator
        </NavLink>

        <NavLink to="/analytics" className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}>
          <span>◩</span>
          Analytics
        </NavLink>
      </nav>

      <div className="sidebar__footer">
        <span className="status-dot"></span>
        Test Mode
      </div>
    </aside>
  );
}

export default Sidebar;
