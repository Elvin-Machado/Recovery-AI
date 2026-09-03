import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import RecoveryQueue from "./pages/RecoveryQueue";
import Simulator from "./pages/Simulator";
import Receivables from "./pages/Receivables";
import Promises from "./pages/Promises";
import Analytics from "./pages/Analytics";

import Transactions from "./pages/Transactions";
import Customers from "./pages/Customers";
import Subscriptions from "./pages/Subscriptions";

function App() {
  return (
    <Router>
      <div className="app flex h-screen">
        <Sidebar />

        <div className="app__content flex-1 bg-[#F8F9FA] overflow-y-auto h-screen">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/queue" element={<RecoveryQueue />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/receivables" element={<Receivables />} />
            <Route path="/promises" element={<Promises />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;