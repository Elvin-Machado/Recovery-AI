import { useState } from "react";
import { simulateReceivable } from "../services/api";

function Receivables() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [invoices, setInvoices] = useState([]);

  const [formData, setFormData] = useState({
    customer_name: "Acme Corp (B2B)",
    amount: "50000",
    days_overdue: 5,
    current_status: "OVERDUE", // ISSUED, DUE, OVERDUE, PAID, PROMISE_PENDING
    attempt_count: 0,
    simulated_customer_action: "ignored" // paid, promise_pending, ignored
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const applyPreset = (presetName) => {
    setResult(null);
    setError(null);
    
    if (presetName === 'new_overdue') {
      setFormData({ ...formData, customer_name: "Tech Solutions Ltd.", current_status: 'OVERDUE', attempt_count: 0, days_overdue: 3, simulated_customer_action: 'ignored' });
    } else if (presetName === 'escalation') {
      setFormData({ ...formData, customer_name: "Global Industries", current_status: 'OVERDUE', attempt_count: 3, days_overdue: 45, simulated_customer_action: 'ignored' });
    } else if (presetName === 'promise') {
      setFormData({ ...formData, customer_name: "Promise Corp", current_status: 'PROMISE_PENDING', attempt_count: 1, days_overdue: 15, simulated_customer_action: 'promise_pending' });
    } else if (presetName === 'paid') {
      setFormData({ ...formData, customer_name: "Paid Systems", current_status: 'PAID', attempt_count: 2, days_overdue: 12, simulated_customer_action: 'paid' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const invId = "INV-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      const payload = {
        invoice_id: invId,
        customer_name: formData.customer_name,
        amount: parseFloat(formData.amount),
        days_overdue: parseInt(formData.days_overdue),
        current_status: formData.current_status,
        attempt_count: parseInt(formData.attempt_count),
        simulated_customer_action: formData.simulated_customer_action
      };
      const res = await simulateReceivable(payload);
      setResult(res);

      if (res.status !== "PAID") {
         // Auto-step the sequencer if it failed/ignored and wasn't blocked!
         if (res.recovery_analysis?.decision?.status === "approved" && res.recovery_analysis.revenue_event.status !== "pending_customer_action" && res.recovery_analysis.revenue_event.status !== "recovered") {
            setFormData(f => ({...f, attempt_count: parseInt(f.attempt_count) + 1}));
         } else if (res.recovery_analysis?.revenue_event?.status === "pending_customer_action") {
            setFormData(f => ({...f, current_status: "PROMISE_PENDING"}));
         }
      }
      
      setInvoices(prev => [res, ...prev]);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAnalysis = () => result?.recovery_analysis;
  
  return (
    <main className="dashboard overflow-auto h-full p-8 bg-[#F8F9FA]">
      <header className="mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-800/5 rounded-bl-full -z-10"></div>
        <div>
          <span className="text-xs font-bold text-gray-800 tracking-wider uppercase mb-1 block">B2B Receivables</span>
          <h1 className="text-2xl font-bold text-gray-900">Compliant Chaser Pipeline</h1>
          <p className="text-sm text-gray-500 mt-2">
            Simulate deterministic overdue invoice handling natively routing through RecoverAI guardrails.
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full mb-2">SIMULATED / TEST MODE</span>
          <p className="text-xs text-gray-400 font-medium">No real money / No actual emails</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLL: FORM */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-fit">
          <div className="mb-6 pb-6 border-b border-gray-100">
             <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Simulation Presets</h3>
             <div className="flex flex-wrap gap-2">
               <button type="button" onClick={() => applyPreset('new_overdue')} className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-50 text-blue-700">New Overdue (Stage 1)</button>
               <button type="button" onClick={() => applyPreset('promise')} className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-50 text-amber-700">Promise Pending</button>
               <button type="button" onClick={() => applyPreset('paid')} className="px-3 py-1.5 text-xs font-semibold rounded bg-green-50 text-green-700">Already Paid</button>
               <button type="button" onClick={() => applyPreset('escalation')} className="px-3 py-1.5 text-xs font-semibold rounded bg-red-50 text-red-700">Max Reminders / Escalation</button>
             </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Company/Customer</label>
                  <input required name="customer_name" value={formData.customer_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"/>
               </div>
               <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Invoice Amount (₹)</label>
                  <input required type="number" name="amount" min="1" value={formData.amount} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"/>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Simulated Invoice Status</label>
                  <select name="current_status" value={formData.current_status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50">
                    <option value="OVERDUE">OVERDUE / AT RISK</option>
                    <option value="PROMISE_PENDING">PROMISE PENDING</option>
                    <option value="PAID">PAID</option>
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Days Overdue</label>
                  <input type="number" name="days_overdue" value={formData.days_overdue} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"/>
               </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
               <h4 className="text-sm font-bold text-gray-800 mb-3">Chaser State Engine</h4>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Current Reminder Stage</label>
                    <div className="flex items-center gap-2">
                       <input type="range" name="attempt_count" min="0" max="4" value={formData.attempt_count} onChange={handleInputChange} className="flex-1"/>
                       <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">{formData.attempt_count}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Automatic guardrail hits STOPPED at stage 3.</p>
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Simulated Outcome</label>
                    <select name="simulated_customer_action" value={formData.simulated_customer_action} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm bg-white">
                      <option value="ignored">Customer Ignores (Continues loop)</option>
                      <option value="promise_pending">Customer Makes Promise (Halts automation)</option>
                      <option value="paid">Customer Pays (Recovers & Stops)</option>
                    </select>
                 </div>
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full mt-6 bg-[#1a1a24] hover:bg-[#2b2b36] text-white font-bold py-3 px-4 rounded text-sm transition-colors">
              {loading ? "Simulating..." : "Trigger Selected Pipeline State"}
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm border border-red-200 rounded">
                <strong>Error: </strong>{error}
              </div>
            )}
          </form>
        </section>

        {/* RIGHT COL: RESULT */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col h-[700px]">
           <div className="flex-none mb-4 pb-4 border-b border-gray-100 flex justify-between items-center">
             <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Simulation Output</h3>
             {result && result.status !== "PAID" && (
                <a href="/queue" className="text-xs font-bold text-gray-600 hover:text-gray-900 underline px-3 py-1.5">
                   View in Recovery Queue →
                </a>
             )}
           </div>

           <div className="flex-1 overflow-auto">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <div className="text-4xl mb-4">⚙️</div>
                  <p>Trigger a Receivables event to trace the Chaser loop.</p>
                </div>
              )}

              {loading && (
                 <div className="h-full flex flex-col items-center justify-center">
                  <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-semibold text-gray-600 animate-pulse">Processing compliance guardrails...</p>
                 </div>
              )}

              {result && (
                <div className="animate-fade-in space-y-4">
                  {/* Basic Event Box */}
                  <div className={`p-4 rounded border ${result.status === "PAID" ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex justify-between items-start mb-2">
                       <strong className={`text-lg flex items-center gap-2 ${result.status === "PAID" ? "text-green-800" : "text-gray-800"}`}>
                         {result.status === "PAID" ? "✅ Invoice Paid" : "⚠ Overdue Tracked"}
                       </strong>
                       <span className="text-xs font-mono text-gray-500">{result.event_id}</span>
                    </div>
                    <p className={`text-sm ${result.status === "PAID" ? "text-green-700" : "text-gray-600"}`}>{result.message}</p>
                  </div>

                  {/* RecoverAI Analysis Box */}
                  {result.status !== "PAID" && getAnalysis() && (
                    <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                       <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                          <h4 className="font-bold text-gray-800 text-sm">DETERMINISTIC EVALUATION</h4>
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-800 text-xs font-bold rounded-full">₹{result.amount.toLocaleString()} overdue</span>
                       </div>
                       
                       <div className="p-4 bg-white space-y-4 text-sm">
                          {/* AI Block - Explicitly Bypassed */}
                          <div className="pb-3 border-b border-gray-100">
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-500 font-semibold">Diagnosis:</span>
                                <strong className="text-gray-800 capitalize">{getAnalysis().diagnosis?.category?.replaceAll('_', ' ')}</strong>
                             </div>
                             <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-500 font-medium">
                                Receivables AI prediction unavailable. Using deterministic risk/policy module cleanly mapping compliance.
                             </div>
                          </div>

                          {/* Policy Block */}
                          <div className="pb-3 border-b border-gray-100">
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-500 font-semibold">Policy Enforcement:</span>
                                <span className={`font-bold ${getAnalysis().decision?.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                   {getAnalysis().decision?.status === 'approved' ? 'Chaser Permitted' : 'Action Blocked'}
                                </span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-semibold">Allocated Chaser:</span>
                                <strong className="text-gray-800 capitalize text-right flex-1 ml-4 leading-tight">
                                  {getAnalysis().decision?.recommended_action?.replaceAll('_', ' ')}
                                  {getAnalysis().decision?.status !== 'approved' && <span className="block text-[10px] text-red-500 mt-1">({getAnalysis().decision?.reason})</span>}
                                </strong>
                             </div>
                          </div>

                          {/* Action Block */}
                          <div>
                             <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-semibold">Resulting Track State:</span>
                                
                                {getAnalysis().revenue_event?.status === 'recovered' && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">Paid</span>}
                                {getAnalysis().revenue_event?.status === 'blocked' && <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">Stopped/Escalated</span>}
                                {getAnalysis().revenue_event?.status === 'pending_customer_action' && <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">Promise Pending</span>}
                                {getAnalysis().revenue_event?.status === 'failed' && <span className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs font-bold">Chased</span>}
                             </div>
                          </div>

                       </div>
                    </div>
                  )}

                </div>
              )}
           </div>
        </section>
      </div>

    </main>
  );
}

export default Receivables;