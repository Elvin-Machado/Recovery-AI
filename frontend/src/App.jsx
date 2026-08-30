import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <div className="app">
      <Sidebar />

      <div className="app__content">
        <Dashboard />
      </div>
    </div>
  );
}

export default App;