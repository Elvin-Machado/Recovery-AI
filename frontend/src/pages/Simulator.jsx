import { useState } from "react";
import { simulateTransaction, simulateCheckout, simulateSubscription } from "../services/api";

function getSimulationTitle(result, mode) {
  if (!result) return "";

  if (result.status === "success") {
    if (mode === "transaction") return "✅ Payment Successful";
    if (mode === "checkout") return "✅ Checkout Completed Successfully";
    if (mode === "subscription") return "✅ Subscription Charge Successful";
    return "✅ Completed Successfully";
  }

  const eventType = result.recovery_analysis?.revenue_event?.event_type || result.recovery_analysis?.event?.event_type;

  if (eventType === "payment.failed" || mode === "transaction") {
    return "❌ Payment Gateway Failure";
  }
  if (eventType === "checkout.abandoned" || mode === "checkout") {
    return "❌ Checkout Abandoned";
  }
  if (eventType === "subscription.charged.failed" || mode === "subscription") {
    if (result.status === "halted") return "⛔ Subscription Halted";
    return "❌ Subscription Charge Failed";
  }
  if (eventType === "b2b.receivable.overdue") {
    return "❌ B2B Invoice Overdue";
  }

  return "❌ Payment Gateway Failure";
}

function Simulator() {
  const [mode, setMode] = useState("transaction"); // "transaction", "checkout" or "subscription"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [formData, setFormData] = useState({
    customer_name: "Demo Customer",
    customer_email: "demo@example.com",
    amount: "8000",
    payment_method: "card",
    outcome: "failed",
    failure_code: "temporary_decline",
    attempt_count: 1,
    mandate_status: "active",
    previous_successful_payments: 5,
    days_since_last_payment: 15,
    checkout_outcome: "abandoned",
    customer_return_behavior: "pending",
    subscription_outcome: "failed",
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
    
    if (mode === "transaction") {
      if (presetName === 'recoverable') {
        setFormData({ ...formData, customer_name: "Recoverable Demo User", outcome: 'failed', failure_code: 'insufficient_funds', mandate_status: 'active', previous_successful_payments: 45, attempt_count: 0 });
      } else if (presetName === 'blocked') {
        setFormData({ ...formData, customer_name: "Blocked Demo User", outcome: 'failed', failure_code: 'account_closed', mandate_status: 'revoked', previous_successful_payments: 2, attempt_count: 3 });
      } else if (presetName === 'pending') {
        setFormData({ ...formData, customer_name: "Pending Demo User", outcome: 'failed', failure_code: 'card_expired', mandate_status: 'inactive', attempt_count: 1 });
      } else if (presetName === 'success') {
        setFormData({ ...formData, customer_name: "Successful Demo User", outcome: 'success', failure_code: '', mandate_status: 'active' });
      }
    } else if (mode === "checkout") {
      if (presetName === 'abandoned_recoverable') {
        setFormData({ ...formData, customer_name: "Abandoned User", checkout_outcome: 'abandoned', attempt_count: 0, customer_return_behavior: 'recovered' });
      } else if (presetName === 'abandoned_blocked') {
        setFormData({ ...formData, customer_name: "Blocked Abandoned User", checkout_outcome: 'abandoned', attempt_count: 2, customer_return_behavior: 'pending' });
      } else if (presetName === 'checkout_success') {
        setFormData({ ...formData, customer_name: "Completed Checkout", checkout_outcome: 'success' });
      }
    } else if (mode === "subscription") {
      if (presetName === 'sub_retry') {
        setFormData({ ...formData, customer_name: "Sub Retry Eligible", subscription_outcome: 'failed', failure_code: 'insufficient_funds', mandate_status: 'active', previous_successful_payments: 25, attempt_count: 1 });
      } else if (presetName === 'sub_halted') {
        setFormData({ ...formData, customer_name: "Sub Exhausted Halt", subscription_outcome: 'failed', failure_code: 'insufficient_funds', mandate_status: 'active', previous_successful_payments: 25, attempt_count: 3 });
      } else if (presetName === 'sub_revoke') {
        setFormData({ ...formData, customer_name: "Mandate Revoked", subscription_outcome: 'failed', failure_code: 'card_expired', mandate_status: 'revoked', previous_successful_payments: 5, attempt_count: 0 });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const txId = "sim_" + Math.random().toString(36).substring(2, 11);

    try {
      if (mode === "transaction") {
        const payload = {
          ...formData,
          transaction_id: txId,
          amount: parseFloat(formData.amount),
          attempt_count: parseInt(formData.attempt_count),
          previous_successful_payments: parseInt(formData.previous_successful_payments),
          days_since_last_payment: parseInt(formData.days_since_last_payment),
          failure_code: formData.outcome === "success" ? null : formData.failure_code
        };
        const res = await simulateTransaction(payload);
        setResult(res);
      } else if (mode === "checkout") {
        const payload = {
          checkout_id: txId,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          outcome: formData.checkout_outcome,
          attempt_count: parseInt(formData.attempt_count),
          customer_return_behavior: formData.customer_return_behavior
        };
        const res = await simulateCheckout(payload);
        setResult(res);
      } else if (mode === "subscription") {
        // We reuse the same persistent ID locally if the user is iterating the sequencer explicitly
        const subId = formData.custom_sub_id || "sim_sub_" + Math.random().toString(36).substring(2, 8);
        const payload = {
          subscription_id: subId,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          outcome: formData.subscription_outcome,
          failure_code: formData.subscription_outcome === "success" || formData.subscription_outcome === "halted" ? null : formData.failure_code,
          attempt_count: parseInt(formData.attempt_count),
          mandate_status: formData.mandate_status,
          previous_successful_payments: parseInt(formData.previous_successful_payments),
          days_since_last_payment: parseInt(formData.days_since_last_payment),
        };
        const res = await simulateSubscription(payload);
        setResult(res);
        // Step forward the UI sequencer natively to save UI clicks for the demo tracking
        if (res.status === "failed" && res.recovery_analysis?.decision?.recommended_action === "controlled_retry" && res.recovery_analysis?.decision?.status === "approved") {
           setFormData(f => ({ ...f, attempt_count: parseInt(f.attempt_count) + 1, custom_sub_id: subId }));
        }
      }
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
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -z-10"></div>
        <div>
          <span className="text-xs font-bold text-[#4B3DE7] tracking-wider uppercase mb-1 block">RecoverPay</span>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Simulation Matrix</h1>
          <p className="text-sm text-gray-500 mt-2">
            Simulate payment gateway failures or checkout abandonments directly through the robust RecoverAI pipeline.
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full mb-2">SIMULATED / TEST MODE</span>
          <p className="text-xs text-gray-400 font-medium">No real money is transferred</p>
        </div>
      </header>

      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-2 flex gap-2">
         <button 
           onClick={() => { setMode("transaction"); setResult(null); setError(null); }} 
           className={`flex-1 py-3 text-sm font-semibold rounded ${mode === "transaction" ? "bg-[#4B3DE7] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
         >
           Payment Gateway Failure Simulation
         </button>
         <button 
           onClick={() => { setMode("checkout"); setResult(null); setError(null); }} 
           className={`flex-1 py-3 text-sm font-semibold rounded ${mode === "checkout" ? "bg-[#4B3DE7] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
         >
           Checkout Abandonment
         </button>
         <button 
           onClick={() => { setMode("subscription"); setResult(null); setError(null); }} 
           className={`flex-1 py-3 text-sm font-semibold rounded ${mode === "subscription" ? "bg-[#4B3DE7] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
         >
           Subscription Mandate Retry Sequencer
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLL: FORM */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="mb-6 pb-6 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Demo Scenarios</h3>
            <div className="flex flex-wrap gap-2">
              {mode === "transaction" ? (
                <>
                  <button type="button" onClick={() => applyPreset('recoverable')} className="px-3 py-1.5 text-xs font-semibold rounded bg-green-50 text-green-700">Recoverable Failure</button>
                  <button type="button" onClick={() => applyPreset('blocked')} className="px-3 py-1.5 text-xs font-semibold rounded bg-red-50 text-red-700">Policy Blocked</button>
                  <button type="button" onClick={() => applyPreset('pending')} className="px-3 py-1.5 text-xs font-semibold rounded bg-orange-50 text-orange-700">Customer Action</button>
                  <button type="button" onClick={() => applyPreset('success')} className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-50 text-blue-700">Successful Payment</button>
              </>
            ) : mode === "checkout" ? (
              <>
                  <button type="button" onClick={() => applyPreset('abandoned_recoverable')} className="px-3 py-1.5 text-xs font-semibold rounded bg-orange-50 text-orange-700">Send Recovery Link</button>
                  <button type="button" onClick={() => applyPreset('abandoned_blocked')} className="px-3 py-1.5 text-xs font-semibold rounded bg-red-50 text-red-700">Spam Guard Blocked</button>
                  <button type="button" onClick={() => applyPreset('checkout_success')} className="px-3 py-1.5 text-xs font-semibold rounded bg-green-50 text-green-700">Completed Successfully</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => applyPreset('sub_retry')} className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-50 text-blue-700">Retry Eligible</button>
                  <button type="button" onClick={() => applyPreset('sub_halted')} className="px-3 py-1.5 text-xs font-semibold rounded bg-red-50 text-red-700">Exhausted Halt</button>
                  <button type="button" onClick={() => applyPreset('sub_revoke')} className="px-3 py-1.5 text-xs font-semibold rounded bg-orange-50 text-orange-700">Revoked Mandate</button>
                </>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Customer Name</label>
                  <input required name="customer_name" value={formData.customer_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"/>
               </div>
               <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₹)</label>
                  <input required type="number" name="amount" min="1" value={formData.amount} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"/>
               </div>
            </div>

            {mode === "transaction" ? (
              <>
                 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction Outcome</label>
                      <select name="outcome" value={formData.outcome} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50">
                        <option value="success">Payment Successful</option>
                        <option value="failed">Payment Failed</option>
                      </select>
                   </div>
                   {formData.outcome === "failed" && (
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Failure Code</label>
                        <select name="failure_code" value={formData.failure_code} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                          <option value="insufficient_funds">Insufficient Funds</option>
                          <option value="temporary_decline">Temporary Decline</option>
                          <option value="card_expired">Card Expired</option>
                          <option value="account_closed">Account Closed</option>
                          <option value="timeout">Timeout</option>
                        </select>
                     </div>
                   )}
                </div>
                
                <details className="text-sm mt-4 p-4 bg-gray-50 rounded border border-gray-200">
                   <summary className="font-semibold text-gray-600 cursor-pointer outline-none">Advanced Simulator Tweaks</summary>
                   <div className="grid grid-cols-2 gap-4 mt-4">
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Current Attempt Count</label>
                        <input type="number" name="attempt_count" min="0" value={formData.attempt_count} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"/>
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Mandate Status</label>
                        <select name="mandate_status" value={formData.mandate_status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="revoked">Revoked</option>
                          <option value="none">None</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Prev Successful Payments</label>
                        <input type="number" name="previous_successful_payments" value={formData.previous_successful_payments} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"/>
                     </div>
                   </div>
                </details>
              </>
            ) : mode === "checkout" ? (
              <>
                 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Checkout Status</label>
                      <select name="checkout_outcome" value={formData.checkout_outcome} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50">
                        <option value="abandoned">Mark Checkout Abandoned</option>
                        <option value="success">Checkout Completed Successfully</option>
                      </select>
                   </div>
                   {formData.checkout_outcome === "abandoned" && (
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Simulated Recovery Outcome</label>
                        <select name="customer_return_behavior" value={formData.customer_return_behavior} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-green-700">
                          <option value="recovered">Customer returning and paid (Recovered)</option>
                          <option value="failed">Customer ignores recovery attempt</option>
                          <option value="pending">Customer pauses/delays attempt</option>
                        </select>
                    </div>
                   )}
                </div>
                
                {formData.checkout_outcome === "abandoned" && (
                  <details className="text-sm mt-4 p-4 bg-gray-50 rounded border border-gray-200">
                     <summary className="font-semibold text-gray-600 cursor-pointer outline-none">Spam Protection Guardrails</summary>
                     <div className="mt-4">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Prior Checkout Reminders Sent</label>
                        <input type="number" name="attempt_count" min="0" max="5" value={formData.attempt_count} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm"/>
                        <p className="text-xs text-gray-400 mt-1">If ≥ 1, the AI intervention will be safely blocked by deterministic spam policy limits.</p>
                     </div>
                  </details>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Subscription Charge Status</label>
                      <select name="subscription_outcome" value={formData.subscription_outcome} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-semibold bg-gray-50 text-indigo-800">
                        <option value="success">Charge Successful</option>
                        <option value="failed">Charge Failed (Trigger Sequencer)</option>
                        <option value="halted">Explicitly Halted</option>
                      </select>
                   </div>
                   {formData.subscription_outcome === "failed" && (
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Failure Code</label>
                        <select name="failure_code" value={formData.failure_code} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                          <option value="insufficient_funds">Insufficient Funds (Soft Decline)</option>
                          <option value="temporary_decline">Temporary Decline (Soft Decline)</option>
                          <option value="card_expired">Card Expired (Hard Decline)</option>
                          <option value="account_closed">Account Closed (Hard Decline)</option>
                        </select>
                     </div>
                   )}
                </div>
                
                {formData.subscription_outcome === "failed" && (
                  <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                     <h4 className="text-sm font-bold text-indigo-800 mb-3">Subscription Retries & Limits</h4>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-xs font-semibold text-indigo-700 mb-1">Attempt Count (Max 3)</label>
                          <div className="flex items-center gap-2">
                             <input type="range" name="attempt_count" min="0" max="4" value={formData.attempt_count} onChange={handleInputChange} className="flex-1"/>
                             <span className="font-bold text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200">{formData.attempt_count}</span>
                          </div>
                          <p className="text-[10px] text-indigo-600 mt-1">Simulate consecutive failures. Hits 3 = HALTED.</p>
                       </div>
                       <div>
                          <label className="block text-xs font-semibold text-indigo-700 mb-1">Mandate Status</label>
                          <select name="mandate_status" value={formData.mandate_status} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-indigo-200 rounded text-sm bg-white">
                            <option value="active">Active (Retry Eligible)</option>
                            <option value="inactive">Inactive</option>
                            <option value="revoked">Revoked (Instantly Blocked)</option>
                          </select>
                       </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <button disabled={loading} type="submit" className="w-full mt-6 bg-[#1a1a24] hover:bg-[#2b2b36] text-white font-bold py-3 px-4 rounded text-sm transition-colors">
              {loading ? "Simulating..." : "Process Test Action"}
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
             {result && result.status !== "success" && (
                <a href="/queue" className="text-xs font-bold text-[#4B3DE7] hover:underline px-3 py-1.5 border border-[#4B3DE7] rounded bg-blue-50">
                   View in Recovery Queue →
                </a>
             )}
           </div>

           <div className="flex-1 overflow-auto">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <div className="text-4xl mb-4">⚙️</div>
                  <p>Run a simulation to trace its lifecycle.</p>
                </div>
              )}

              {loading && (
                 <div className="h-full flex flex-col items-center justify-center">
                  <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-semibold text-gray-600 animate-pulse">Running simulated action...</p>
                 </div>
              )}

              {result && (
                <div className="animate-fade-in space-y-4">
                  {/* Basic Event Box */}
                  <div className={`p-4 rounded border ${result.status === "success" ? "bg-green-50 border-green-200" : (result.status === "halted" ? "bg-red-50 border-red-200" : "bg-red-50 border-red-200")}`}>
                    <div className="flex justify-between items-start mb-2">
                       <strong className={`text-lg flex items-center gap-2 ${result.status === "success" ? "text-green-800" : "text-red-800"}`}>
                         {getSimulationTitle(result, mode)}
                       </strong>
                       <span className="text-xs font-mono text-gray-500">{result.event_id}</span>
                    </div>
                    <p className={`text-sm ${result.status === "success" ? "text-green-700" : "text-red-700"}`}>{result.message}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 bg-white p-2 rounded">
                      <div><span className="font-semibold block">Customer</span>{result.customer}</div>
                      <div><span className="font-semibold block">Amount</span>₹{result.amount.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* RecoverAI Analysis Box */}
                  {result.status !== "success" && getAnalysis() && (
                    <div className="mt-6 border border-blue-100 rounded-lg overflow-hidden shadow-sm">
                       <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
                          <h4 className="font-bold text-blue-900 text-sm">RECOVERAI ANALYSIS</h4>
                          <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs font-bold rounded-full">₹{result.amount.toLocaleString()} at risk</span>
                       </div>
                       
                       <div className="p-4 bg-white space-y-4 text-sm">
                          {/* AI Block */}
                          <div className="pb-3 border-b border-gray-100">
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-500 font-semibold">Diagnosis:</span>
                                <strong className="text-gray-800 capitalize">{getAnalysis().diagnosis?.category?.replaceAll('_', ' ')}</strong>
                             </div>
                             {getAnalysis().prediction_unavailable ? (
                                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-600 font-medium">
                                   AI prediction unavailable for this event type. A deterministic policy fallback is active.
                                </div>
                             ) : (
                                <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded mt-2">
                                   <span className="text-blue-800 font-semibold text-xs">AI Recovery Probability:</span>
                                   <strong className="text-blue-900 text-lg">{(getAnalysis().diagnosis?.confidence * 100).toFixed(1)}%</strong>
                                </div>
                             )}
                          </div>

                          {/* Policy Block */}
                          <div className="pb-3 border-b border-gray-100">
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-500 font-semibold">Policy Engine:</span>
                                <span className={`font-bold ${getAnalysis().decision?.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                   {getAnalysis().decision?.status === 'approved' ? 'Recovery Permitted' : 'Recovery Blocked'}
                                </span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-semibold">Recommended Action:</span>
                                <strong className="text-gray-800 capitalize text-right flex-1 ml-4 leading-tight">{getAnalysis().decision?.recommended_action?.replaceAll('_', ' ')}</strong>
                             </div>
                          </div>

                          {/* Action Block */}
                          <div>
                             <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-semibold">Execution Event Status:</span>
                                
                                {getAnalysis().revenue_event?.status === 'recovered' && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">Recovered</span>}
                                {getAnalysis().revenue_event?.status === 'blocked' && <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">Blocked</span>}
                                {getAnalysis().revenue_event?.status === 'pending_customer_action' && <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">Pending Customer</span>}
                                {getAnalysis().revenue_event?.status === 'failed' && <span className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs font-bold">Failed</span>}
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

export default Simulator;