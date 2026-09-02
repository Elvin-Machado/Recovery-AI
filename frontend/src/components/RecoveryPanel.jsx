import { useState } from "react";
import { processRecovery } from "../services/api";

function RecoveryPanel({
  item,
  onClose,
  onRecoveryComplete,
}) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleProcess() {
    setLoading(true);
    setError(null);

    try {
      const data = await processRecovery(
            item.event,
            item.customer
            );

      setResult(data);

      if (onRecoveryComplete) {
        await onRecoveryComplete();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const diagnosis = result?.diagnosis;
  const decision = result?.decision;
  const action = result?.action;
  const recoveryResult = result?.recovery_result;

  return (
    <div className="recovery-overlay">
      <div className="recovery-panel">

        <div className="recovery-panel__header">
          <div>
            <span className="eyebrow">
              Recovery analysis
            </span>

            <h2>
              {item.customer.name}
            </h2>

            <p>
              Payment recovery decision for{" "}
              ₹{item.event.amount.toLocaleString("en-IN")}
            </p>
          </div>

          <button
            className="close-button"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="recovery-summary">

          <div className="recovery-summary__item">
            <span>Failure reason</span>
            <strong>
              {item.event.failure_code
                ? item.event.failure_code.replaceAll("_", " ")
                : "—"}
            </strong>
          </div>

          <div className="recovery-summary__item">
            <span>Attempt</span>
            <strong>
              {item.event.attempt_count} / 3
            </strong>
          </div>

          <div className="recovery-summary__item">
            <span>Amount</span>
            <strong>
              ₹{item.event.amount.toLocaleString("en-IN")}
            </strong>
          </div>

        </div>

        {!result && !loading && (
          <div className="recovery-start">

            <span className="eyebrow">
              AI recovery agent
            </span>

            <h3>
              Analyze this payment failure
            </h3>

            <p>
              RecoverAI will diagnose the failure,
              predict recovery probability, evaluate
              the recovery policy, and determine the
              appropriate action.
            </p>

            <button
              className="primary-button"
              type="button"
              onClick={handleProcess}
            >
              Analyze & Recover
            </button>

          </div>
        )}

        {loading && (
          <div className="recovery-loading">
            <div className="loading-spinner"></div>

            <h3>
              Recovery agent is analyzing...
            </h3>

            <p>
              Running diagnosis, ML prediction and
              policy checks.
            </p>
          </div>
        )}

        {error && (
          <div className="recovery-error">
            <strong>Recovery failed</strong>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="recovery-results">

            <div className="result-section">
              <span className="eyebrow">
                01 · Diagnosis
              </span>

              <div className="result-card">
                <div>
                  <span className="result-label">
                    Problem detected
                  </span>

                  <strong>
                    {diagnosis?.category
                      ?.replaceAll("_", " ")}
                  </strong>
                </div>

                <div className="confidence">
                  {Math.round(
                    diagnosis?.confidence * 100
                  )}
                  %
                  <span>
                    confidence
                  </span>
                </div>
              </div>

              {diagnosis?.reason && (
                <p className="result-explanation">
                  {diagnosis.reason}
                </p>
              )}
            </div>

            <div className="result-section">
              <span className="eyebrow">
                02 · Decision
              </span>

              <div className="result-card">
                <div>
                  <span className="result-label">
                    Recommended action
                  </span>

                  <strong>
                    {decision?.recommended_action
                      ?.replaceAll("_", " ")}
                  </strong>
                </div>

                <span
                  className={`decision-status ${
                    decision?.status === "approved"
                      ? "decision-status--approved"
                      : "decision-status--blocked"
                  }`}
                >
                  {decision?.status}
                </span>
              </div>

              <p className="result-explanation">
                {decision?.reason}
              </p>
            </div>

            <div className="result-section">
              <span className="eyebrow">
                03 · Action
              </span>

              <div className="result-card">
                <div>
                  <span className="result-label">
                    Execution status
                  </span>

                  <strong>
                    {action?.status?.replaceAll(
                      "_",
                      " "
                    )}
                  </strong>
                </div>

                <span className="action-icon">
                  {action?.status === "success"
                    ? "✓"
                    : action?.status === "blocked"
                    ? "!"
                    : "•"}
                </span>
              </div>
            </div>

            {recoveryResult && (
              <div className="recovery-result">

                <span className="eyebrow">
                  Recovery outcome
                </span>

                <div className="recovery-result__amount">
                  ₹
                  {Number(
                    recoveryResult.recovered_amount
                  ).toLocaleString("en-IN")}
                </div>

                <p>
                  {recoveryResult.success
                    ? "Revenue successfully recovered."
                    : "Recovery action did not recover revenue."}
                </p>

              </div>
            )}

            <div className="agent-flow">
              <div className="agent-flow__step">
                <span>1</span>
                <strong>Diagnose</strong>
              </div>

              <div className="agent-flow__arrow">
                →
              </div>

              <div className="agent-flow__step">
                <span>2</span>
                <strong>Predict</strong>
              </div>

              <div className="agent-flow__arrow">
                →
              </div>

              <div className="agent-flow__step">
                <span>3</span>
                <strong>Policy</strong>
              </div>

              <div className="agent-flow__arrow">
                →
              </div>

              <div className="agent-flow__step">
                <span>4</span>
                <strong>Act</strong>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default RecoveryPanel;