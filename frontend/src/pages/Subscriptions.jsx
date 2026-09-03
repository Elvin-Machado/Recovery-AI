import { useEffect, useState, useMemo } from "react";
import StatCard from "../components/StatCard";
import RecoveryPanel from "../components/RecoveryPanel";
import { getSubscriptions } from "../services/api";

function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [mandateFilter, setMandateFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  async function loadSubscriptions() {
    try {
      setLoading(true);
      setError(null);
      const data = await getSubscriptions(200);
      setSubscriptions(data || []);
    } catch (err) {
      setError(err.message || "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const handleRecoveryComplete = async () => {
    await loadSubscriptions();
  };

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      // Mandate filter
      if (mandateFilter !== "All") {
        if (mandateFilter === "Active" && sub.mandate_status !== "active") return false;
        if (mandateFilter === "Revoked" && sub.mandate_status !== "revoked") return false;
      }

      // Status filter
      if (statusFilter !== "All") {
        if (statusFilter === "Recovered" && sub.status !== "recovered") return false;
        if (statusFilter === "Pending Customer" && sub.status !== "pending_customer_action") return false;
        if (statusFilter === "Blocked" && sub.status !== "blocked") return false;
        if (statusFilter === "Failed" && sub.status !== "failed") return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const name = (sub.customer?.name || "").toLowerCase();
        const email = (sub.customer?.email || "").toLowerCase();
        const code = (sub.failure_code || "").toLowerCase();
        const id = (sub.id || "").toLowerCase();

        return name.includes(term) || email.includes(term) || code.includes(term) || id.includes(term);
      }

      return true;
    });
  }, [subscriptions, mandateFilter, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    const totalCount = subscriptions.length;
    let activeMandates = 0;
    let revokedMandates = 0;
    let totalRecoveredSum = 0;

    for (const sub of subscriptions) {
      if (sub.mandate_status === "active") activeMandates++;
      if (sub.mandate_status === "revoked") revokedMandates++;
      if (sub.status === "recovered") totalRecoveredSum += Number(sub.amount || 0);
    }

    return { totalCount, activeMandates, revokedMandates, totalRecoveredSum };
  }, [subscriptions]);

  function getStatusLabel(status) {
    switch (status) {
      case "recovered": return "Recovered";
      case "detected": return "At Risk";
      case "pending_customer_action": return "Pending Customer";
      case "blocked": return "Blocked";
      case "failed": return "Failed";
      default: return status || "—";
    }
  }

  if (loading) {
    return (
      <main className="dashboard">
        <header className="dashboard__header">
          <div>
            <span className="eyebrow">Recurring Revenue Intelligence</span>
            <h1>Subscriptions</h1>
            <p>Loading failed subscription charges & mandate retries...</p>
          </div>
        </header>
        <div className="p-8 text-center text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-[#4B3DE7] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Fetching subscription data from database...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard">
        <header className="dashboard__header">
          <div>
            <span className="eyebrow">Recurring Revenue Intelligence</span>
            <h1>Subscriptions</h1>
          </div>
        </header>
        <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <h3 className="font-semibold text-lg mb-1">Unable to load subscriptions</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            type="button"
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
            onClick={loadSubscriptions}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div>
          <span className="eyebrow">Recurring Revenue Intelligence</span>
          <h1>Subscription Recovery</h1>
          <p>
            Monitor failed recurring subscription charges, mandate retry sequencing, revoked mandates, and policy-bounded recovery actions.
          </p>
        </div>
        <div className="mode-badge">TEST MODE</div>
      </header>

      <section className="stats-grid">
        <StatCard
          label="Total Subscription Charges"
          value={stats.totalCount}
          description="Failed recurring attempts"
        />
        <StatCard
          label="Active Mandates"
          value={stats.activeMandates}
          description="Eligible for retry sequencing"
        />
        <StatCard
          label="Revoked Mandates"
          value={stats.revokedMandates}
          description="Auto-retry blocked by policy"
        />
        <StatCard
          label="Recovered Subscription Revenue"
          value={`₹${stats.totalRecoveredSum.toLocaleString("en-IN")}`}
          description="Successfully recovered"
        />
      </section>

      <div className="event-table flex flex-col bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="section-heading p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-t-lg">
          <div>
            <span className="eyebrow text-gray-500 font-semibold tracking-wider text-xs uppercase block mb-1">
              Subscription Events ({filteredSubscriptions.length} shown)
            </span>
            <h2 className="text-xl font-bold text-gray-800">Subscription Charges</h2>
          </div>

          <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search customer, ID, failure code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#4B3DE7] min-w-[220px]"
            />

            <select
              value={mandateFilter}
              onChange={(e) => setMandateFilter(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#4B3DE7]"
            >
              <option value="All">All Mandates</option>
              <option value="Active">Active Mandate</option>
              <option value="Revoked">Revoked Mandate</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#4B3DE7]"
            >
              <option value="All">All Statuses</option>
              <option value="Recovered">Recovered</option>
              <option value="Pending Customer">Pending Customer</option>
              <option value="Blocked">Blocked</option>
              <option value="Failed">Failed</option>
            </select>

            <button
              className="px-4 py-1.5 bg-gray-50 text-gray-700 text-sm rounded-md font-medium hover:bg-gray-100 border border-gray-200 transition-colors"
              type="button"
              onClick={loadSubscriptions}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="table-wrapper overflow-x-auto bg-white rounded-b-lg">
          {filteredSubscriptions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-base font-medium">No subscription events match the selected criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mandate</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Attempt</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Failure Code</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredSubscriptions.map((sub) => {
                  const dateStr = sub.created_at
                    ? new Date(sub.created_at).toLocaleDateString("en-IN", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      })
                    : "—";

                  const isRevoked = sub.mandate_status === "revoked";

                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-6 py-4">
                        <strong className="text-sm text-gray-900 block">
                          {sub.customer?.name || "Unknown"}
                        </strong>
                        <span className="text-xs text-gray-500">{sub.customer?.email}</span>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                          isRevoked ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {sub.mandate_status || "active"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-gray-700">
                        Attempt {sub.attempt_count} / 3
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700 capitalize">
                        {sub.failure_code ? sub.failure_code.replaceAll("_", " ") : "—"}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ₹{Number(sub.amount || 0).toLocaleString("en-IN")}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold event-status event-status--${sub.status}`}>
                          {getStatusLabel(sub.status)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-[#4B3DE7] border border-[#4B3DE7]/30 rounded hover:bg-[#4B3DE7]/10 transition-colors"
                          type="button"
                          onClick={() => setSelectedEvent(sub)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedEvent && (
        <RecoveryPanel
          item={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRecoveryComplete={handleRecoveryComplete}
        />
      )}
    </main>
  );
}

export default Subscriptions;