import { useEffect, useState } from "react";
import {
  getAnalyticsSummary,
  getAnalyticsCategories,
  runAnalyticsBatch,
  getModelBenchmark,
} from "../services/api";

function Analytics() {
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [batchError, setBatchError] = useState(null);

  async function loadAnalytics() {
    try {
      setError(null);
      const [s, c, b] = await Promise.all([
        getAnalyticsSummary(),
        getAnalyticsCategories(),
        getModelBenchmark(),
      ]);
      setSummary(s);
      setCategories(c);
      setBenchmark(b);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunBatch() {
    try {
      setBatchLoading(true);
      setBatchError(null);
      const result = await runAnalyticsBatch();
      setBatchResult(result);
      await loadAnalytics();
    } catch (err) {
      setBatchError(err.message);
    } finally {
      setBatchLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <main className="dashboard">
        <h1>Loading analytics...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard">
        <h1>Unable to load analytics</h1>
        <p>{error}</p>
        <button type="button" onClick={loadAnalytics}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="dashboard">
      {/* HEADER */}
      <header className="dashboard__header">
        <div>
          <span className="eyebrow">Recovery Economics</span>
          <h1>Recovery Analytics</h1>
          <p>
            Measured recovery economics across revenue-risk cases.
            All figures are from simulated/test data.
          </p>
        </div>
        <div className="mode-badge">SIMULATED DATA</div>
      </header>

      {/* BATCH CONTROL */}
      <section className="analytics-batch-control">
        <div className="analytics-batch-control__info">
          <h3>Demo Recovery Batch</h3>
          <p>
            Run 10 deterministic recovery scenarios through the real RecoverAI
            pipeline. Duplicate runs are safely detected.
          </p>
          <span className="analytics-env-badge">TEST MODE</span>
        </div>
        <button
          className="primary-button"
          onClick={handleRunBatch}
          disabled={batchLoading}
        >
          {batchLoading ? "Running..." : "Run Demo Recovery Batch"}
        </button>
      </section>

      {batchError && (
        <div className="recovery-error" style={{ marginBottom: 20 }}>
          <p>{batchError}</p>
        </div>
      )}

      {/* BATCH RESULT */}
      {batchResult && (
        <section className="analytics-batch-result">
          <div className="analytics-section-header">
            <h2>Demo Batch Result</h2>
            <span className="analytics-env-badge">{batchResult.label}</span>
          </div>
          <p className="analytics-section-note">
            Section B — reflects ONLY the selected deterministic batch above.
            It is independent of, and does not replace, the persisted analytics
            in Section A.
          </p>

          <div className="analytics-batch-summary">
            <div className="analytics-batch-item">
              <span>Batch ID</span>
              <strong>{batchResult.batch_id}</strong>
            </div>
            <div className="analytics-batch-item">
              <span>Status</span>
              <strong>{batchResult.status}</strong>
            </div>
            <div className="analytics-batch-item">
              <span>Cases Processed</span>
              <strong>{batchResult.cases_processed}</strong>
            </div>
            <div className="analytics-batch-item">
              <span>Amount at Risk</span>
              <strong>
                ₹{batchResult.total_amount_at_risk.toLocaleString("en-IN")}
              </strong>
            </div>
            <div className="analytics-batch-item">
              <span>Amount Recovered</span>
              <strong>
                ₹{batchResult.total_amount_recovered.toLocaleString("en-IN")}
              </strong>
            </div>
            <div className="analytics-batch-item">
              <span>Recovery Rate</span>
              <strong>
                {batchResult.recovery_rate_denominator > 0
                  ? `${batchResult.recovered || batchResult.eligible_interventions > 0 ? Math.round(batchResult.recovery_rate * 100) : 0}%`
                  : "N/A"}
                {batchResult.recovery_rate_denominator > 0 && (
                  <span className="analytics-rate-detail">
                    {" "}
                    ({Math.round(batchResult.recovery_rate * batchResult.recovery_rate_denominator)}/{batchResult.recovery_rate_denominator})
                  </span>
                )}
              </strong>
            </div>
            <div className="analytics-batch-item">
              <span>Eligible</span>
              <strong>{batchResult.eligible_interventions}</strong>
            </div>
            <div className="analytics-batch-item">
              <span>Blocked</span>
              <strong>{batchResult.blocked_actions}</strong>
            </div>
            <div className="analytics-batch-item">
              <span>Pending</span>
              <strong>{batchResult.pending_customer_action}</strong>
            </div>
            <div className="analytics-batch-item">
              <span>Net Recovery</span>
              <strong className={batchResult.net_recovery >= 0 ? "analytics-positive" : "analytics-negative"}>
                ₹{batchResult.net_recovery.toLocaleString("en-IN")}
              </strong>
            </div>
          </div>

          {/* ECONOMICS FLOW */}
          <div className="analytics-economics-flow">
            <h3>Recovery Economics Flow</h3>
            <div className="analytics-flow-steps">
              <div className="analytics-flow-step">
                <span className="analytics-flow-label">₹ at Risk</span>
                <span className="analytics-flow-value">
                  ₹{batchResult.total_amount_at_risk.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="analytics-flow-arrow">↓</div>
              <div className="analytics-flow-step">
                <span className="analytics-flow-label">Interventions Allowed</span>
                <span className="analytics-flow-value">
                  {batchResult.eligible_interventions}
                </span>
              </div>
              <div className="analytics-flow-arrow">↓</div>
              <div className="analytics-flow-step">
                <span className="analytics-flow-label">Actions Executed</span>
                <span className="analytics-flow-value">
                  {batchResult.actions_executed}
                </span>
              </div>
              <div className="analytics-flow-arrow">↓</div>
              <div className="analytics-flow-step">
                <span className="analytics-flow-label">Successful Recoveries</span>
                <span className="analytics-flow-value">
                  {batchResult.eligible_interventions > 0
                    ? Math.round(batchResult.recovery_rate * batchResult.recovery_rate_denominator)
                    : 0}
                </span>
              </div>
              <div className="analytics-flow-arrow">↓</div>
              <div className="analytics-flow-step">
                <span className="analytics-flow-label">₹ Recovered</span>
                <span className="analytics-flow-value analytics-positive">
                  ₹{batchResult.total_amount_recovered.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="analytics-flow-arrow">↓</div>
              <div className="analytics-flow-step">
                <span className="analytics-flow-label">Intervention Cost</span>
                <span className="analytics-flow-value analytics-negative">
                  ₹{batchResult.total_intervention_cost.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="analytics-flow-arrow">↓</div>
              <div className="analytics-flow-step analytics-flow-final">
                <span className="analytics-flow-label">Net Recovery</span>
                <span className={`analytics-flow-value ${batchResult.net_recovery >= 0 ? "analytics-positive" : "analytics-negative"}`}>
                  ₹{batchResult.net_recovery.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <p className="analytics-assumption-note">
              Intervention cost assumption: ₹{batchResult.intervention_cost_per_action} per action
              — Simulation Economic Assumption, not a Razorpay fee.
            </p>
          </div>

          {/* BATCH CASE TABLE */}
          <div className="analytics-table-wrapper">
            <h3>Batch Cases</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Scenario</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Diagnosis</th>
                    <th>Decision</th>
                    <th>Action</th>
                    <th>Outcome</th>
                    <th>Recovered</th>
                  </tr>
                </thead>
                <tbody>
                  {(batchResult.cases || []).map((c) => (
                    <tr key={c.index}>
                      <td>{c.index + 1}</td>
                      <td>{c.name}</td>
                      <td>{formatEventType(c.event_type)}</td>
                      <td>₹{c.amount.toLocaleString("en-IN")}</td>
                      <td>{c.diagnosis || "—"}</td>
                      <td>
                        <span
                          className={`event-status event-status--${c.decision_status === "approved" ? "recovered" : c.decision_status === "blocked" ? "blocked" : "detected"}`}
                        >
                          {c.decision_status}
                        </span>
                      </td>
                      <td>{c.action_status}</td>
                      <td>
                        <span
                          className={`event-status event-status--${c.recovered ? "recovered" : c.action_status === "pending_customer_action" ? "pending_customer_action" : "failed"}`}
                        >
                          {c.recovered
                            ? "recovered"
                            : c.action_status}
                        </span>
                      </td>
                      <td>
                        {c.recovered_amount > 0
                          ? `₹${c.recovered_amount.toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* KPI CARDS — SECTION A: PERSISTED DATA */}
      {summary && (
        <section className="analytics-kpi-section">
          <div className="analytics-section-header">
            <h2>Persisted Recovery Analytics</h2>
            <span className="analytics-env-badge persisted">PERSISTED DATA</span>
          </div>
          <p className="analytics-section-note">
            Section A — the aggregate of ALL currently stored (persisted)
            recovery records in the database. This is independent of the demo
            batch in Section B; the two figures are intentionally not merged.
          </p>
          <div className="analytics-kpi-grid">
            <KPICard label="Cases Evaluated" value={summary.total_cases} />
            <KPICard
              label="Revenue at Risk"
              value={`₹${summary.total_amount_at_risk.toLocaleString("en-IN")}`}
            />
            <KPICard label="AI Evaluated" value={summary.ai_evaluated} />
            <KPICard
              label="Deterministic Evaluated"
              value={summary.deterministic_evaluated}
            />
            <KPICard
              label="Eligible Interventions"
              value={summary.eligible_interventions}
            />
            <KPICard
              label="Blocked Actions"
              value={summary.blocked_actions}
            />
            <KPICard
              label="Pending Customer"
              value={summary.pending_customer_action}
            />
            <KPICard
              label="Actions Executed"
              value={summary.actions_executed}
            />
            <KPICard
              label="Recovery Rate"
              value={
                summary.recovery_rate_denominator > 0
                  ? `${Math.round(summary.recovery_rate * 100)}%`
                  : "N/A"
              }
              description={
                summary.recovery_rate_denominator > 0
                  ? `${Math.round(summary.recovery_rate * summary.recovery_rate_denominator)}/${summary.recovery_rate_denominator} eligible`
                  : "No eligible interventions"
              }
            />
            <KPICard
              label="Amount Recovered"
              value={`₹${summary.total_amount_recovered.toLocaleString("en-IN")}`}
            />
            <KPICard
              label="Intervention Cost"
              value={`₹${summary.total_intervention_cost.toLocaleString("en-IN")}`}
              description={`₹${summary.intervention_cost_per_action} per action (assumption)`}
            />
            <KPICard
              label="Net Recovery"
              value={`₹${summary.net_recovery.toLocaleString("en-IN")}`}
              description="Gross recovered minus intervention cost"
              accent={summary.net_recovery >= 0 ? "positive" : "negative"}
            />
          </div>
        </section>
      )}

      {/* CATEGORY BREAKDOWN */}
      {categories && categories.length > 0 && (
        <section className="analytics-category-section">
          <h2>Category Breakdown</h2>
          <div className="analytics-table-wrapper">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Cases</th>
                    <th>At Risk</th>
                    <th>Eligible</th>
                    <th>Blocked</th>
                    <th>Pending</th>
                    <th>Recovered</th>
                    <th>₹ Recovered</th>
                    <th>Rate</th>
                    <th>Evaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.name}>
                      <td><strong>{cat.name}</strong></td>
                      <td>{cat.cases}</td>
                      <td>₹{cat.amount_at_risk.toLocaleString("en-IN")}</td>
                      <td>{cat.eligible}</td>
                      <td>{cat.blocked}</td>
                      <td>{cat.pending}</td>
                      <td>{cat.recovered}</td>
                      <td>₹{cat.amount_recovered.toLocaleString("en-IN")}</td>
                      <td>
                        {cat.eligible > 0
                          ? `${Math.round(cat.recovery_rate * 100)}%`
                          : "N/A"}
                      </td>
                      <td>
                        {cat.ai_evaluated > 0 && (
                          <span className="analytics-eval-badge analytics-eval-badge--ai">
                            AI: {cat.ai_evaluated}
                          </span>
                        )}
                        {cat.deterministic_evaluated > 0 && (
                          <span className="analytics-eval-badge analytics-eval-badge--det">
                            Policy: {cat.deterministic_evaluated}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* AI VS DETERMINISTIC */}
      {summary && (
        <section className="analytics-ai-det-section">
          <h2>AI vs Deterministic Evaluation</h2>
          <div className="analytics-ai-det-grid">
            <div className="analytics-ai-det-card">
              <span className="analytics-ai-det-icon">ML</span>
              <div>
                <strong>{summary.ai_evaluated}</strong>
                <span>cases evaluated by Random Forest model</span>
                <p>Payment failures, subscription mandate retries</p>
              </div>
            </div>
            <div className="analytics-ai-det-card">
              <span className="analytics-ai-det-icon analytics-ai-det-icon--det">P</span>
              <div>
                <strong>{summary.deterministic_evaluated}</strong>
                <span>cases evaluated by deterministic policy</span>
                <p>Checkout abandonment, B2B receivables, promise-to-pay</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* MODEL BENCHMARK */}
      {benchmark && (
        <section className="analytics-benchmark-section">
          <h2>Recovery Model Benchmark</h2>
          <div className="analytics-benchmark-note">
            {benchmark.label}
          </div>
          <div className="analytics-benchmark-grid">
            <div className="analytics-benchmark-card">
              <span>ROC-AUC</span>
              <strong>{benchmark.roc_auc}</strong>
            </div>
            <div className="analytics-benchmark-card">
              <span>PR-AUC</span>
              <strong>{benchmark.pr_auc}</strong>
            </div>
            <div className="analytics-benchmark-card">
              <span>Brier Score</span>
              <strong>{benchmark.brier_score}</strong>
            </div>
          </div>
          <p className="analytics-benchmark-disclaimer">
            {benchmark.note}
          </p>
        </section>
      )}

      {/* AUDIT TRAIL INDICATION */}
      <section className="analytics-audit-section">
        <h2>Audit Trail</h2>
        <p>
          Every batch-created recovery case is traceable through:
          batch → revenue event → diagnosis → decision → policy → action → recovery result → audit log.
          All simulated/test data is clearly labelled.
        </p>
        <div className="analytics-audit-flow">
          <span className="analytics-audit-step">Batch</span>
          <span className="analytics-audit-arrow">→</span>
          <span className="analytics-audit-step">Revenue Event</span>
          <span className="analytics-audit-arrow">→</span>
          <span className="analytics-audit-step">Diagnosis</span>
          <span className="analytics-audit-arrow">→</span>
          <span className="analytics-audit-step">Decision</span>
          <span className="analytics-audit-arrow">→</span>
          <span className="analytics-audit-step">Policy</span>
          <span className="analytics-audit-arrow">→</span>
          <span className="analytics-audit-step">Action</span>
          <span className="analytics-audit-arrow">→</span>
          <span className="analytics-audit-step">Recovery Result</span>
          <span className="analytics-audit-arrow">→</span>
          <span className="analytics-audit-step">Audit Log</span>
        </div>
      </section>
    </main>
  );
}

function KPICard({ label, value, description, accent }) {
  return (
    <div className={`analytics-kpi ${accent ? `analytics-kpi--${accent}` : ""}`}>
      <span className="analytics-kpi-label">{label}</span>
      <span className="analytics-kpi-value">{value}</span>
      {description && (
        <span className="analytics-kpi-desc">{description}</span>
      )}
    </div>
  );
}

function formatEventType(eventType) {
  const map = {
    "payment.failed": "Payment Failure",
    "checkout.abandoned": "Checkout",
    "subscription.charged.failed": "Subscription",
    "b2b.receivable.overdue": "B2B Receivable",
    "promise.broken": "Promise",
  };
  return map[eventType] || eventType || "—";
}

export default Analytics;
