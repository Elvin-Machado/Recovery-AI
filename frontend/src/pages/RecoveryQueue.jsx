import EventTable from "../components/EventTable";

function RecoveryQueue() {
  return (
    <main className="dashboard overflow-auto h-full">
      <header className="dashboard__header mb-6">
        <div>
          <span className="eyebrow">Operations Console</span>
          <h1>Recovery Queue</h1>
          <p>
            Filter and manage revenue events, track AI probability, and review policy decisions.
          </p>
        </div>
      </header>

      <EventTable fullView={true} />
    </main>
  );
}

export default RecoveryQueue;
