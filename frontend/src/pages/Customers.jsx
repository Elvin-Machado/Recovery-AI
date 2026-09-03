import { useEffect, useState, useMemo } from "react";
import StatCard from "../components/StatCard";
import { getCustomers } from "../services/api";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activityFilter, setActivityFilter] = useState("All");

  async function loadCustomers() {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomers(200);
      setCustomers(data || []);
    } catch (err) {
      setError(err.message || "Failed to load customer directory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Activity filter
      if (activityFilter === "At Risk" && c.total_at_risk <= 0) return false;
      if (activityFilter === "Recovered" && c.total_recovered <= 0) return false;
      if (activityFilter === "Active Events" && c.event_count <= 0) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const name = (c.name || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();

        return name.includes(term) || email.includes(term) || phone.includes(term);
      }

      return true;
    });
  }, [customers, activityFilter, searchTerm]);

  const stats = useMemo(() => {
    const totalCount = customers.length;
    let atRiskCustomers = 0;
    let totalRiskSum = 0;
    let totalRecoveredSum = 0;

    for (const c of customers) {
      if (c.total_at_risk > 0) atRiskCustomers++;
      totalRiskSum += Number(c.total_at_risk || 0);
      totalRecoveredSum += Number(c.total_recovered || 0);
    }

    return { totalCount, atRiskCustomers, totalRiskSum, totalRecoveredSum };
  }, [customers]);

  if (loading) {
    return (
      <main className="dashboard">
        <header className="dashboard__header">
          <div>
            <span className="eyebrow">Merchant Customers</span>
            <h1>Customers</h1>
            <p>Loading customer profiles...</p>
          </div>
        </header>
        <div className="p-8 text-center text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-[#4B3DE7] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Fetching customer directory from database...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard">
        <header className="dashboard__header">
          <div>
            <span className="eyebrow">Merchant Customers</span>
            <h1>Customers</h1>
          </div>
        </header>
        <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <h3 className="font-semibold text-lg mb-1">Unable to load customers</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            type="button"
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
            onClick={loadCustomers}
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
          <span className="eyebrow">Merchant Customers</span>
          <h1>Customer Directory</h1>
          <p>
            View merchant profiles, event histories, total risk exposure, and total recovered revenue per customer.
          </p>
        </div>
        <div className="mode-badge">TEST MODE</div>
      </header>

      <section className="stats-grid">
        <StatCard
          label="Total Customers"
          value={stats.totalCount}
          description="Registered profiles"
        />
        <StatCard
          label="Customers at Risk"
          value={stats.atRiskCustomers}
          description="Have unresolved events"
        />
        <StatCard
          label="Total Risk Exposure"
          value={`₹${stats.totalRiskSum.toLocaleString("en-IN")}`}
          description="Outstanding unrecovered"
        />
        <StatCard
          label="Total Recovered"
          value={`₹${stats.totalRecoveredSum.toLocaleString("en-IN")}`}
          description="Revenue recovered"
        />
      </section>

      <div className="event-table flex flex-col bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="section-heading p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-t-lg">
          <div>
            <span className="eyebrow text-gray-500 font-semibold tracking-wider text-xs uppercase block mb-1">
              Customer Roster ({filteredCustomers.length} shown)
            </span>
            <h2 className="text-xl font-bold text-gray-800">All Customers</h2>
          </div>

          <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search customer name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#4B3DE7] min-w-[240px]"
            />

            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#4B3DE7]"
            >
              <option value="All">All Profiles</option>
              <option value="At Risk">Has Risk Exposure</option>
              <option value="Recovered">Has Recoveries</option>
              <option value="Active Events">Has Events</option>
            </select>

            <button
              className="px-4 py-1.5 bg-gray-50 text-gray-700 text-sm rounded-md font-medium hover:bg-gray-100 border border-gray-200 transition-colors"
              type="button"
              onClick={loadCustomers}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="table-wrapper overflow-x-auto bg-white rounded-b-lg">
          {filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-base font-medium">No customers match the selected criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Events</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">At Risk</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recovered</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Activity</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <strong className="text-sm text-gray-900 block">{c.name}</strong>
                        <span className="text-xs text-gray-400">ID: {c.id.slice(0, 8)}...</span>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{c.email || "—"}</div>
                        <div className="text-xs text-gray-400">{c.phone || ""}</div>
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-gray-700">
                        {c.event_count}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-amber-700">
                        {c.total_at_risk > 0 ? `₹${c.total_at_risk.toLocaleString("en-IN")}` : "₹0"}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-green-700">
                        {c.total_recovered > 0 ? `₹${c.total_recovered.toLocaleString("en-IN")}` : "₹0"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {c.recent_event ? (
                          <div>
                            <span className="font-medium text-gray-800">{c.recent_event.type_label}</span>
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold event-status event-status--${c.recent_event.status}`}>
                              {c.recent_event.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">No events</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-[#4B3DE7] border border-[#4B3DE7]/30 rounded hover:bg-[#4B3DE7]/10 transition-colors"
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                        >
                          View Profile
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

      {/* CUSTOMER PROFILE DRAWER MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-[550px] h-full bg-white shadow-2xl flex flex-col transform transition-transform animate-slide-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Customer Profile
                </span>
                <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedCustomer.email || "No email"}</p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2"
                type="button"
                onClick={() => setSelectedCustomer(null)}
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Phone</span>
                  <strong className="text-gray-900">{selectedCustomer.phone || "—"}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Customer ID</span>
                  <span className="text-xs text-gray-700 font-mono">{selectedCustomer.id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Total at Risk</span>
                  <strong className="text-amber-700 text-base">₹{selectedCustomer.total_at_risk.toLocaleString("en-IN")}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Total Recovered</span>
                  <strong className="text-green-700 text-base">₹{selectedCustomer.total_recovered.toLocaleString("en-IN")}</strong>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Event History ({selectedCustomer.events?.length || 0})
                </h3>

                {(!selectedCustomer.events || selectedCustomer.events.length === 0) ? (
                  <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded border border-gray-100">
                    No revenue events recorded for this customer.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                        <tr>
                          <th className="p-3">Type</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Reason</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedCustomer.events.map((ev) => (
                          <tr key={ev.id} className="hover:bg-gray-50/50">
                            <td className="p-3 font-medium text-gray-900">{ev.type_label}</td>
                            <td className="p-3 font-semibold text-gray-900">₹{ev.amount.toLocaleString("en-IN")}</td>
                            <td className="p-3 text-gray-500 capitalize">{ev.failure_code?.replaceAll("_", " ") || "—"}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold event-status event-status--${ev.status}`}>
                                {ev.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Customers;