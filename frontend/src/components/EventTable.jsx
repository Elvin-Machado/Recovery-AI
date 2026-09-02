import { useEffect, useState } from "react";
import RecoveryPanel from "./RecoveryPanel";
import { getDashboardEvents } from "../services/api";

function EventTable({ onRecoveryComplete }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  function getStatusLabel(status) {
    switch (status) {
      case "recovered":
        return "Recovered";

      case "detected":
        return "Recovery opportunity";

      case "pending_customer_action":
        return "Pending customer action";

      case "blocked":
        return "Blocked";

      case "failed":
        return "Failed";

      default:
        return status;
    }
  }

  return (
    <>
      <div className="event-table">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              Revenue signals
            </span>

            <h2>Recent events</h2>
          </div>

          <button
            type="button"
            onClick={loadEvents}
          >
            View all
          </button>
        </div>

        <div className="table-wrapper">
          {loading && (
            <p>Loading events...</p>
          )}

          {error && (
            <div className="error-message">
              <p>Unable to load events</p>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {events.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.customer.name}
                      </strong>
                    </td>

                    <td>
                      {item.type}
                    </td>

                    <td>
                      ₹
                      {Number(
                        item.event.amount
                      ).toLocaleString("en-IN")}
                    </td>

                    <td>
                      <span
                        className={`event-status event-status--${item.status}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </td>

                    <td>
                      {item.status !== "recovered" && (
                        <button
                          className="review-button"
                          type="button"
                          onClick={() =>
                            setSelectedEvent(item)
                          }
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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