function EventTable() {
  const events = [
    {
      customer: "Rahul Sharma",
      type: "Payment Failure",
      amount: "₹2,499",
      status: "Needs diagnosis",
    },
    {
      customer: "Ananya Rao",
      type: "Subscription Failed",
      amount: "₹1,999",
      status: "Recovery pending",
    },
    {
      customer: "Vikram Singh",
      type: "Mandate Revoked",
      amount: "₹4,999",
      status: "Win-back required",
    },
  ];

  return (
    <div className="event-table">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Revenue signals</span>
          <h2>Recent events</h2>
        </div>

        <button>View all</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Event</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {events.map((event) => (
              <tr key={event.customer}>
                <td>{event.customer}</td>
                <td>{event.type}</td>
                <td>{event.amount}</td>
                <td>
                  <span className="event-status">
                    {event.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EventTable;