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
        <a href="#" className="sidebar__link sidebar__link--active">
          <span>◉</span>
          Dashboard
        </a>

        <a href="#" className="sidebar__link">
          <span>◈</span>
          Revenue Risk
        </a>

        <a href="#" className="sidebar__link">
          <span>↗</span>
          Recovery
        </a>

        <a href="#" className="sidebar__link">
          <span>◇</span>
          Decisions
        </a>

        <a href="#" className="sidebar__link">
          <span>≡</span>
          Audit Trail
        </a>
      </nav>

      <div className="sidebar__footer">
        <span className="status-dot"></span>
        Test Mode
      </div>
    </aside>
  );
}

export default Sidebar;
