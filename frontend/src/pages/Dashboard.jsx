import { useEffect, useState } from "react";
import StatCard from "../components/StatCard";
import EventTable from "../components/EventTable";
import { getDashboard } from "../services/api";

function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadDashboard() {
    try {
      setError(null);

      const data = await getDashboard();

      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard() {
    try {
      const data = await getDashboard();

      setDashboard(data);
    } catch (err) {
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="dashboard">
        <h1>Loading dashboard...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard">
        <h1>Unable to load dashboard</h1>
        <p>{error}</p>

        <button
          type="button"
          onClick={loadDashboard}
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div>
          <span className="eyebrow">
            Merchant overview
          </span>

          <h1>Revenue Recovery</h1>

          <p>
            Detect revenue at risk, understand why it is
            slipping, and recover it safely.
          </p>
        </div>

        <div className="mode-badge">
          Razorpay Test Mode
        </div>
      </header>

      <section className="stats-grid">
        <StatCard
          label="Revenue at Risk"
          value={`₹${dashboard.revenue_at_risk.toLocaleString("en-IN")}`}
          description="Events requiring attention"
        />

        <StatCard
          label="Recovered"
          value={`₹${dashboard.recovered.toLocaleString("en-IN")}`}
          description="Recovered revenue"
        />

        <StatCard
          label="Recovery Opportunities"
          value={dashboard.opportunities}
          description="Across revenue events"
        />

        <StatCard
          label="Blocked Actions"
          value={dashboard.blocked_actions}
          description="Stopped by policy engine"
        />
      </section>

      <EventTable
        onRecoveryComplete={refreshDashboard}
      />
    </main>
  );
}

export default Dashboard;