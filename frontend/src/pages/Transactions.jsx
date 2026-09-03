import { useEffect, useState, useMemo } from "react";
import StatCard from "../components/StatCard";
import RecoveryPanel from "../components/RecoveryPanel";
import { getDashboardEvents } from "../services/api";

function Transactions() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function loadTransactions() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardEvents(500);
      setEvents(data || []);
    } catch (err) {
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleRecoveryComplete = async () => {
    await loadTransactions();
  };

  const filteredEvents = useMemo(() => {
    return events.filter((item) => {
      // Status filter
      if (statusFilter !== "All") {
        if (statusFilter === "At Risk" && item.status !== "detected") return false;
        if (statusFilter === "Recovered" && item.status !== "recovered") return false;
        if (statusFilter === "Pending Customer" && item.status !== "pending_customer_action") return false;
        if (statusFilter === "Blocked" && item.status !== "blocked") return false;
        if (statusFilter === "Failed" && item.status !== "failed") return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const name = (item.customer?.name || "").toLowerCase();
        const email = (item.customer?.email || "").toLowerCase();
        const type = (item.type || "").toLowerCase();
        const code = (item.event?.failure_code || "").toLowerCase();
        const id = (item.id || "").toLowerCase();

        return (
          name.includes(term) ||
          email.includes(term) ||
          type.includes(term) ||
          code.includes(term) ||
          id.includes(term)
        );
      }

      return true;
    });
  }, [events, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    const totalCount = events.length;
    let atRiskSum = 0;
    let recoveredSum = 0;
    let pendingCount = 0;

    for (const e of events) {
      const amt = Number(e.event?.amount || 0);
      if (e.status === "detected" || e.status === "failed" || e.status === "blocked" || e.status === "pending_customer_action") {
        atRiskSum += amt;
      }
      if (e.status === "recovered") {
        recoveredSum += amt;
      }
      if (e.status === "pending_customer_action") {
        pendingCount++;
      }
    }

    return { totalCount, atRiskSum, recoveredSum, pendingCount };
  }, [events]);

  function getStatusLabel(status) {
    switch (status) {
      case "recovered": return "Recovered";
      case "detected": return "At Risk";
      case "pending_customer_action": return "Pending Customer";
      case "blocked": return "Blocked";
      case "failed": return "Failed";
      case "no_action": return "No Action";
      default: return status || "—";
    }
  }

  if (loading) {
    return (
      <main className="dashboard">
        <header className="dashboard__header">
          <div>
            <span className="eyebrow">Transaction Audit Trail</span>
            <h1>Transactions</h1>
            <p>Loading transactions history...</p>
          </div>
        </header>
        <div className="p-8 text-center text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-[#4B3DE7] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Fetching transaction records from database...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard">
        <header className="dashboard__header">
          <div>
            <span className="eyebrow">Transaction Audit Trail</span>
            <h1>Transactions</h1>
          </div>
        </header>
        <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <h3 className="font-semibold text-lg mb-1">Unable to load transactions</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            type="button"
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
            onClick={loadTransactions}
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
          <span className="eyebrow">Transaction Audit Trail</span>
          <h1>Transactions History</h1>
          <p>
            Complete historical log of all payment failures, checkout abandonments,
            subscriptions, and B2B receivable revenue events.
          </p>
        </div>
        <div className="mode-badge">TEST MODE</div>
      </header>

      <section className="stats-grid">
        <StatCard
          label="Total Transactions"
          value={stats.totalCount}
          description="Recorded in database"
        />
        <StatCard
          label="Revenue at Risk"
          value={`₹${stats.atRiskSum.toLocaleString("en-IN")}`}
          description="Unresolved revenue events"
        />
        <StatCard
          label="Recovered Revenue"
          value={`₹${stats.recoveredSum.toLocaleString("en-IN")}`}
          description="Successfully recovered"
        />
        <StatCard
          label="Pending Customer"
          value={stats.pendingCount}
          description="Awaiting customer action"
        />
      </section>

      <div className="event-table flex flex-col bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="section-heading p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-t-lg">
          <div>
            <span className="eyebrow text-gray-500 font-semibold tracking-wider text-xs uppercase block mb-1">
              Audit Stream ({filteredEvents.length} shown)
            </span>
            <h2 className="text-xl font-bold text-gray-800">All Revenue Events</h2>
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#4B3DE7]"
            >
              <option value="All">All Statuses</option>
              <option value="At Risk">At Risk</option>
              <option value="Recovered">Recovered</option>
              <option value="Pending Customer">Pending Customer</option>
              <option value="Blocked">Blocked</option>
              <option value="Failed">Failed</option>
            </select>

            <button
              className="px-4 py-1.5 bg-gray-50 text-gray-700 text-sm rounded-md font-medium hover:bg-gray-100 border border-gray-200 transition-colors"
              type="button"
              onClick={loadTransactions}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="table-wrapper overflow-x-auto bg-white rounded-b-lg">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-base font-medium">No transactions match the selected filters.</p>
              <p className="text-sm mt-1 text-gray-400">Try adjusting your search terms or filter criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Type</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Failure Reason</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredEvents.map((item) => {
                  const dateVal = item.created_at || item.event?.created_at;
                  const dateStr = dateVal && !isNaN(new Date(dateVal).getTime())
                    ? new Date(dateVal).toLocaleDateString("en-IN", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      })
                    : "—";

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-6 py-4">
                        <strong className="text-sm text-gray-900 block">
                          {item.customer?.name || "Unknown"}
                        </strong>
                        <span className="text-xs text-gray-500">{item.customer?.email}</span>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700">
                        {item.type}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700 capitalize">
                        {item.event?.failure_code ? item.event.failure_code.replaceAll("_", " ") : "—"}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ₹{Number(item.event?.amount || 0).toLocaleString("en-IN")}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold event-status event-status--${item.status}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-[#4B3DE7] border border-[#4B3DE7]/30 rounded hover:bg-[#4B3DE7]/10 transition-colors"
                          type="button"
                          onClick={() => setSelectedEvent(item)}
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

export default Transactions;