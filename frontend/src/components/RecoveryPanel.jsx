import { useState, useEffect } from "react";
import { processRecovery } from "../services/api";

function formatErrorMessage(err) {
  if (!err) return "Unable to analyze this event. Please try again.";

  if (typeof err === "string") {
    if (err.includes("[object Object]")) {
      return "Unable to analyze this event. Please try again.";
    }
    return err;
  }

  let msg = err.message || err.detail || err;

  if (typeof msg === "string") {
    if (msg.includes("[object Object]")) {
      return "Unable to analyze this event. Please try again.";
    }
    try {
      const parsed = JSON.parse(msg);
      if (Array.isArray(parsed)) {
        const text = parsed.map((e) => e.msg || e.detail || "").filter(Boolean).join("; ");
        if (text) return text;
      } else if (parsed && typeof parsed === "object") {
        if (typeof parsed.detail === "string") return parsed.detail;
        if (Array.isArray(parsed.detail)) {
          const text = parsed.detail.map((e) => e.msg || "").filter(Boolean).join("; ");
          if (text) return text;
        }
        if (parsed.message) return parsed.message;
      }
    } catch (_) {}
    return msg;
  }

  if (Array.isArray(msg)) {
    const text = msg.map((e) => (typeof e === "string" ? e : e.msg || e.detail || "")).filter(Boolean).join("; ");
    if (text) return text;
  }

  if (typeof msg === "object" && msg !== null) {
    if (typeof msg.detail === "string") return msg.detail;
    if (typeof msg.message === "string") return msg.message;
  }

  return "Unable to analyze this event. Please try again.";
}

function RecoveryPanel({ item, onClose, onRecoveryComplete }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const eventType = item.event?.event_type || item.event_type || item.type || "";
  const diagnosisCategory = item.diagnosis?.category || "";

  const isB2B =
    eventType === "b2b.receivable.overdue" ||
    eventType === "invoice_overdue" ||
    item.type === "B2B Receivable Overdue" ||
    diagnosisCategory === "invoice_overdue" ||
    item.risk_category === "b2b_receivable";

  const isCheckout =
    eventType === "checkout.abandoned" ||
    item.type === "Checkout Abandoned" ||
    diagnosisCategory === "checkout_abandonment";

  const isPromise =
    eventType === "promise.broken" ||
    item.type === "Promise Broken" ||
    diagnosisCategory === "promise_broken";

  const isPaymentFailure = !isB2B && !isCheckout && !isPromise;

  useEffect(() => {
    if (isPaymentFailure) {
      if (item.status !== "detected" && !result) {
        handleProcess();
      }
    } else {
      if (item.diagnosis || item.decision || item.action || item.recovery_result) {
        setResult({
          diagnosis: item.diagnosis,
          decision: item.decision,
          action: item.action,
          recovery_result: item.recovery_result,
        });
      }
    }
  }, [item.id, item.status, isPaymentFailure]);

  async function handleProcess() {
    if (!isPaymentFailure) return;

    setLoading(true);
    setError(null);

    try {
      const data = await processRecovery(item.event, item.customer);
      setResult(data);

      if (onRecoveryComplete && !data.duplicate) {
        await onRecoveryComplete();
      }
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const diagnosis = result?.diagnosis || item.diagnosis;
  const decision = result?.decision || item.decision;
  const action = result?.action || item.action;
  const recoveryResult = result?.recovery_result || item.recovery_result;

  const recoveryProb = diagnosis?.confidence !== undefined && diagnosis?.confidence !== null
    ? (diagnosis.confidence * 100).toFixed(0)
    : null;

  const amountNum = item.event?.amount !== undefined ? item.event.amount : (item.amount || 0);
  const amountStr = `₹${Number(amountNum).toLocaleString("en-IN")}`;
  const failureReason = isB2B
    ? "Invoice Overdue"
    : (item.event?.failure_code ? item.event.failure_code.replaceAll("_", " ") : "Payment Failure");

  const attemptCount = item.event?.attempt_count !== undefined ? item.event.attempt_count : (item.attempt_count || 0);

  const renderRevenueSection = () => (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Revenue Details</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500 block">Amount at Risk</span>
          <strong className="text-gray-900 text-lg">{amountStr}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Current Status</span>
          <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-semibold event-status event-status--${item.status}`}>
            {item.status.replaceAll("_", " ")}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block">{isB2B ? "Context" : "Failure Reason"}</span>
          <strong className="text-gray-900 capitalize">{isB2B ? "B2B Receivable" : failureReason}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Current Attempt</span>
          <strong className="text-gray-900">{attemptCount} / 3</strong>
        </div>
      </div>
    </div>
  );

  const renderAISection = () => {
    const isUnavailable = isB2B || diagnosis?.confidence === null || diagnosis?.confidence === undefined;

    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {isB2B ? "Deterministic Receivables Policy" : "AI Recovery Intelligence"}
        </h3>
        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <span className="text-gray-500 block text-xs">Diagnosis</span>
              <strong className="text-blue-900 capitalize">
                {isB2B ? "Invoice Overdue" : (diagnosis?.category?.replaceAll("_", " ") || "Payment Failure")}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Recovery Probability</span>
              {isUnavailable ? (
                <strong className="text-gray-500 text-xs">Deterministic Policy Engine Active</strong>
              ) : (
                <strong className="text-blue-900">{recoveryProb}%</strong>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-700 bg-white p-3 rounded border border-blue-50">
            <span className="font-semibold text-gray-800 block mb-1">Policy Explanation:</span>
            {isB2B
              ? "B2B Receivables are managed via deterministic chaser policies rather than probabilistic payment retries."
              : (isUnavailable
                ? "Machine Learning prediction is not available because model bounds are designed for Payment Failure features. A deterministic fallback policy is executing."
                : (diagnosis?.reason || `Model predicted recovery probability at ${recoveryProb}%.`))}
          </div>
        </div>
      </div>
    );
  };

  const renderPolicySection = () => {
    const isBlocked = item.status === "blocked" || decision?.status === "blocked";
    const decisionStatusText = isBlocked ? "BLOCKED" : (decision?.status?.toUpperCase() || "APPROVED");
    const policyReason = decision?.reason || (isB2B && isBlocked ? "maximum permitted chasers reached" : "Condition met for recommended action.");
    const recAction = decision?.recommended_action || (isB2B ? "escalate_receivable" : "controlled_retry");

    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Policy Engine</h3>
        <div className="p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-gray-500 block text-xs">Policy Decision</span>
              <strong className="text-gray-900 capitalize">
                {recAction === "no_action" ? "No Action" : recAction.replaceAll("_", " ")}
              </strong>
            </div>
            <span className={`px-2.5 py-1 rounded text-xs font-bold ${
              !isBlocked ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}>
              {decisionStatusText}
            </span>
          </div>
          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
            <span className="font-semibold text-gray-800 block mb-1">Policy Reason:</span>
            {policyReason}
          </div>
        </div>
      </div>
    );
  };

  const renderExecutionOutcomeSection = () => {
    const isBlocked = item.status === "blocked" || action?.status === "blocked" || decision?.status === "blocked";
    const isPending = item.status === "pending_customer_action" || action?.status === "pending_customer_action";
    const isRecovered = item.status === "recovered" || recoveryResult?.success === true;
    const isFailed = item.status === "failed" || action?.status === "failed";

    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Execution & Outcome</h3>
        
        {isBlocked && (
          <div className="p-4 rounded-lg bg-orange-50 border border-orange-200 text-sm">
            <strong className="text-orange-900 block mb-2 flex items-center gap-2">
              <span className="text-lg">⛔</span> Action Blocked by Policy
            </strong>
            <p className="text-orange-800 mb-2">
              The policy engine prevented automated chasers for <strong>{item.customer?.name || "Customer"}</strong>. {amountStr} remains unrecovered.
            </p>
            <p className="text-orange-900 font-semibold mb-1">Reason: {decision?.reason || "maximum permitted chasers reached"}</p>
            <p className="text-xs text-orange-700 mt-2 font-medium">Resulting Track State: <strong>Stopped / Escalated</strong></p>
          </div>
        )}

        {isPending && !isBlocked && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">
            <strong className="text-amber-900 block mb-2 flex items-center gap-2">
              <span className="text-lg">⏳</span> Pending Customer Action
            </strong>
            <p className="text-amber-800">
              Automatic recovery is paused. The customer has been notified and must manually complete the payment.
            </p>
            <p className="text-amber-800 mt-2">
              Potential Revenue: <strong>{amountStr}</strong>
            </p>
          </div>
        )}

        {isRecovered && !isBlocked && (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm">
            <strong className="text-green-900 block mb-2 flex items-center gap-2">
              <span className="text-lg">✅</span> Revenue successfully recovered!
            </strong>
            <p className="text-green-800 mb-2">
              The recovery action was executed successfully.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4 bg-white p-3 rounded border border-green-100">
              <div>
                <span className="text-gray-500 block text-xs">Recovered Amount</span>
                <strong className="text-green-700">₹{Number(recoveryResult?.recovered_amount || amountNum).toLocaleString("en-IN")}</strong>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Timestamp</span>
                <span className="text-gray-800">{recoveryResult?.created_at ? new Date(recoveryResult.created_at).toLocaleString("en-IN") : "Recorded"}</span>
              </div>
            </div>
          </div>
        )}

        {isFailed && !isBlocked && !isPending && !isRecovered && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm">
             <strong className="text-red-900 block mb-2 flex items-center gap-2">
              <span className="text-lg">❌</span> Recovery Failed
            </strong>
            <p className="text-red-800">
              The recovery action was attempted but did not succeed.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-[500px] h-full bg-white shadow-2xl flex flex-col transform transition-transform animate-slide-in">
        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              {isB2B ? "Receivable Detail" : (isCheckout ? "Checkout Detail" : (isPromise ? "Promise Detail" : "Recovery Analysis"))}
            </span>
            <h2 className="text-xl font-bold text-gray-900">{item.customer?.name || "Unknown Customer"}</h2>
            <p className="text-sm text-gray-500 mt-1">Event ID: {item.event?.event_id || item.id}</p>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2"
            type="button"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-white">
          {renderRevenueSection()}

          {isPaymentFailure && !result && !loading && (
            <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-100 mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Analyze Payment Failure</h3>
              <p className="text-sm text-gray-600 mb-6">
                RecoverAI will diagnose the failure, predict recovery probability, evaluate policy rules, and potentially execute a recovery action.
              </p>
              <button
                className="bg-[#4B3DE7] hover:bg-[#3A2EBD] text-white font-medium py-2.5 px-6 rounded-md transition-colors"
                type="button"
                onClick={handleProcess}
              >
                Analyze & Recover
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center p-12">
              <div className="inline-block w-8 h-8 border-4 border-[#4B3DE7] border-t-transparent rounded-full animate-spin mb-4"></div>
              <h3 className="font-semibold text-gray-800">Agent is Analyzing...</h3>
              <p className="text-sm text-gray-500 mt-2">Diagnosing failure, predicting recovery, and evaluating policy.</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 mt-4">
              <strong className="block mb-1">Analysis Failed</strong>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {(result || !isPaymentFailure) && (
            <div className="animate-fade-in">
              {renderAISection()}
              {renderPolicySection()}
              {renderExecutionOutcomeSection()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecoveryPanel;
