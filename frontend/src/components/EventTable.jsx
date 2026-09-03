import { useEffect, useState, useMemo } from "react";
import RecoveryPanel from "./RecoveryPanel";
import { getDashboardEvents } from "../services/api";

function EventTable({ onRecoveryComplete, fullView = false }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");

  async function loadEvents() {
    try {
      setLoading(true);
      setError(null);

      const data = await getDashboardEvents();
      setEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function handleRecoveryComplete() {
    await loadEvents();
    if (onRecoveryComplete) {
      await onRecoveryComplete();
    }
  }

  const filteredEvents = useMemo(() => {
    if (filter === "All") return events;
    if (filter === "At Risk") return events.filter(e => e.status === "detected");
    if (filter === "Recovered") return events.filter(e => e.status === "recovered");
    if (filter === "Pending Customer") return events.filter(e => e.status === "pending_customer_action");
    if (filter === "Blocked") return events.filter(e => e.status === "blocked");
    if (filter === "Failed") return events.filter(e => e.status === "failed");
    if (filter === "No Action") return events.filter(e => e.status === "no_action" || (e.action && e.action.action_type === "no_action"));
    return events;
  }, [events, filter]);

  const displayEvents = fullView ? filteredEvents : events.slice(0, 5);

  function getStatusLabel(status) {
    switch (status) {
      case "recovered":
        return "Recovered";
      case "detected":
        return "At Risk";
      case "pending_customer_action":
        return "Pending Customer";
      case "blocked":
        return "Blocked";
      case "failed":
        return "Failed";
      case "no_action":
        return "No Action";
      default:
        return status;
    }
  }

  return (
    <>
      <div className="event-table flex flex-col h-full bg-white rounded-lg shadow-sm">
        <div className="section-heading p-6 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-lg">
          <div>
            <span className="eyebrow text-gray-500 font-semibold tracking-wider text-xs uppercase block mb-1">
              Revenue signals
            </span>
            <h2 className="text-xl font-bold text-gray-800">{fullView ? "All Events" : "Recent events"}</h2>
          </div>
          
          <div className="flex gap-4 items-center">
            {fullView && (
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)}
                className="select-filter border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#4B3DE7]"
              >
                <option value="All">All</option>
                <option value="At Risk">At Risk</option>
                <option value="Recovered">Recovered</option>
                <option value="Pending Customer">Pending Customer</option>
                <option value="Blocked">Blocked</option>
                <option value="Failed">Failed</option>
                <option value="No Action">No Action</option>
              </select>
            )}
            
            <button
              className="px-4 py-1.5 bg-gray-50 text-gray-700 text-sm rounded-md font-medium hover:bg-gray-100 border border-gray-200 transition-colors"
              type="button"
              onClick={loadEvents}
            >
              Refresh
            </button>
            
            {!fullView && (
              <a href="/queue" className="text-sm font-semibold text-[#4B3DE7] hover:underline">
                View all →
              </a>
            )}
          </div>
        </div>

        <div className="table-wrapper flex-1 overflow-auto bg-white rounded-b-lg">
          {loading && (
            <p className="p-6 text-gray-500">Loading events...</p>
          )}

          {error && (
            <div className="error-message p-6 text-red-600 bg-red-50 m-4 rounded-md">
              <p className="font-semibold">Unable to load events</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && displayEvents.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p>No events found for the selected filter.</p>
            </div>
          )}

          {!loading && !error && displayEvents.length > 0 && (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 sticky top-0 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Type</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Failure Reason</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Probability</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {displayEvents.map((item) => {
                  const prob = item.diagnosis?.confidence ? (item.diagnosis.confidence * 100).toFixed(0) + "%" : "—";
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
                      
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {item.event?.failure_code || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ₹{Number(item.event?.amount !== undefined ? item.event.amount : (item.amount || 0)).toLocaleString("en-IN")}
                      </td>
                      
                      <td className="px-6 py-4 text-sm text-gray-700">
                         {prob}
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
                  )
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
    </>
  );
}

export default EventTable;