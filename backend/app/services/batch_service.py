import hashlib
import json
from datetime import datetime, timezone

from app.database import supabase
from app.services.recovery_workflow import process_recovery_event
from app.services.promise_service import promise_service
from app.services.persistence_service import persistence_service

# ---------------------------------------------------------
# BATCH CONSTRAINTS
# ---------------------------------------------------------

MAX_BATCH_SIZE = 50

# ---------------------------------------------------------
# DETERMINISTIC BATCH SCENARIOS
# ---------------------------------------------------------


def _curated_scenarios() -> list[dict]:
    """
    Deterministic, repeatable batch of recovery scenarios.
    Each flows through the real RecoverAI pipeline:
      Detect → Diagnose → Decide → Policy → Act → Result → Audit
    """
    return [
        {
            "name": "Payment failure — successful retry",
            "event": {
                "event_id": "batch_12i_case1",
                "event_type": "payment.failed",
                "amount": 10000.00,
                "attempt_count": 1,
                "previous_successful_payments": 5,
                "days_since_last_payment": 10,
                "failure_code": "insufficient_funds",
                "mandate_status": None,
            },
            "customer": {
                "name": "Batch Customer 1",
                "email": "batch1@test.example.com",
            },
        },
        {
            "name": "Payment failure — blocked by retry limit",
            "event": {
                "event_id": "batch_12i_case2",
                "event_type": "payment.failed",
                "amount": 8000.00,
                "attempt_count": 3,
                "previous_successful_payments": 2,
                "days_since_last_payment": 20,
                "failure_code": "insufficient_funds",
                "mandate_status": None,
            },
            "customer": {
                "name": "Batch Customer 2",
                "email": "batch2@test.example.com",
            },
        },
        {
            "name": "Payment failure — customer must update method",
            "event": {
                "event_id": "batch_12i_case3",
                "event_type": "payment.failed",
                "amount": 5000.00,
                "attempt_count": 0,
                "previous_successful_payments": 1,
                "days_since_last_payment": 5,
                "failure_code": "expired_card",
                "mandate_status": None,
            },
            "customer": {
                "name": "Batch Customer 3",
                "email": "batch3@test.example.com",
            },
        },
        {
            "name": "Checkout abandonment — reminder sent, recovered",
            "event": {
                "event_id": "batch_12i_case4",
                "event_type": "checkout.abandoned",
                "amount": 7500.00,
                "attempt_count": 0,
                "previous_successful_payments": 0,
                "days_since_last_payment": 0,
                "failure_code": None,
                "mandate_status": None,
                "simulated_checkout_outcome": "recovered",
            },
            "customer": {
                "name": "Batch Customer 4",
                "email": "batch4@test.example.com",
            },
        },
        {
            "name": "Checkout abandonment — already reminded, blocked",
            "event": {
                "event_id": "batch_12i_case5",
                "event_type": "checkout.abandoned",
                "amount": 6000.00,
                "attempt_count": 1,
                "previous_successful_payments": 0,
                "days_since_last_payment": 0,
                "failure_code": None,
                "mandate_status": None,
                "simulated_checkout_outcome": "pending",
            },
            "customer": {
                "name": "Batch Customer 5",
                "email": "batch5@test.example.com",
            },
        },
        {
            "name": "Failed subscription — mandate active, retry succeeds",
            "event": {
                "event_id": "batch_12i_case6",
                "event_type": "subscription.charged.failed",
                "amount": 900.00,
                "attempt_count": 1,
                "previous_successful_payments": 6,
                "days_since_last_payment": 30,
                "failure_code": "insufficient_funds",
                "mandate_status": "active",
            },
            "customer": {
                "name": "Batch Customer 6",
                "email": "batch6@test.example.com",
            },
        },
        {
            "name": "Failed subscription — mandate revoked, blocked",
            "event": {
                "event_id": "batch_12i_case7",
                "event_type": "subscription.charged.failed",
                "amount": 1200.00,
                "attempt_count": 0,
                "previous_successful_payments": 3,
                "days_since_last_payment": 30,
                "failure_code": "mandate_revoked",
                "mandate_status": "revoked",
            },
            "customer": {
                "name": "Batch Customer 7",
                "email": "batch7@test.example.com",
            },
        },
        {
            "name": "B2B receivable — overdue, paid after reminder",
            "event": {
                "event_id": "batch_12i_case8",
                "event_type": "b2b.receivable.overdue",
                "amount": 30000.00,
                "attempt_count": 0,
                "previous_successful_payments": 0,
                "days_since_last_payment": 45,
                "failure_code": None,
                "mandate_status": None,
                "simulated_checkout_outcome": "paid",
                "current_status": "OVERDUE",
            },
            "customer": {
                "name": "Batch Customer 8",
                "email": "batch8@test.example.com",
            },
        },
        {
            "name": "B2B receivable — promise pending, chase blocked",
            "event": {
                "event_id": "batch_12i_case9",
                "event_type": "b2b.receivable.overdue",
                "amount": 40000.00,
                "attempt_count": 0,
                "previous_successful_payments": 0,
                "days_since_last_payment": 30,
                "failure_code": None,
                "mandate_status": None,
                "simulated_checkout_outcome": "promise_pending",
                "current_status": "PROMISE_PENDING",
            },
            "customer": {
                "name": "Batch Customer 9",
                "email": "batch9@test.example.com",
            },
        },
        {
            "name": "Promise-to-Pay — partial payment recorded",
            "event": {
                "event_id": "batch_12i_promise_1",
                "event_type": "b2b.receivable.overdue",
                "amount": 50000.00,
                "attempt_count": 0,
                "previous_successful_payments": 0,
                "days_since_last_payment": 60,
                "failure_code": None,
                "mandate_status": None,
                "simulated_checkout_outcome": "promise_pending",
                "current_status": "OVERDUE",
            },
            "customer": {
                "name": "Batch Customer 10",
                "email": "batch10@test.example.com",
            },
        },
    ]


# ---------------------------------------------------------
# PROMISE CONSTANTS (for batch case 10)
# ---------------------------------------------------------

BATCH_PROMISE_REF = "batch_12i_promise_case10"
BATCH_PROMISE_INVOICE = "batch_12i_inv_case10"
BATCH_PROMISE_AMOUNT = 50000.00
BATCH_PROMISE_PARTIAL_PAYMENT = 20000.00


def _execute_batch_promise(batch_id: str) -> dict:
    """
    Create a Promise-to-Pay via the real promise_service,
    then record a deterministic partial payment.

    Idempotent: if the promise already exists with payment,
    skip recording to avoid double-counting.
    """
    promise = promise_service.create(
        promise_ref=BATCH_PROMISE_REF,
        invoice_ref=BATCH_PROMISE_INVOICE,
        customer_name="Batch Customer 10",
        customer_email="batch10@test.example.com",
        promised_amount=BATCH_PROMISE_AMOUNT,
        promise_date="2026-12-31",
    )

    # Idempotent: only record payment if not already paid
    if float(promise.get("amount_paid", 0)) == 0.0:
        promise = promise_service.record_payment(
            BATCH_PROMISE_REF,
            BATCH_PROMISE_PARTIAL_PAYMENT,
        )

    return promise


def _load_batch_promise() -> dict | None:
    """Load the batch promise from the promises table."""
    return promise_service.get_by_ref(BATCH_PROMISE_REF)


# ---------------------------------------------------------
# BATCH ID GENERATION
# ---------------------------------------------------------


def _compute_batch_id(scenarios: list[dict]) -> str:
    payload = json.dumps(
        [s["event"]["event_id"] for s in scenarios],
        sort_keys=True,
    )
    digest = hashlib.sha256(payload.encode()).hexdigest()[:12]
    return f"batch_12i_{digest}"


# ---------------------------------------------------------
# BATCH EXECUTION
# ---------------------------------------------------------


def run_batch() -> dict:
    scenarios = _curated_scenarios()

    if len(scenarios) > MAX_BATCH_SIZE:
        raise ValueError(
            f"Batch size {len(scenarios)} exceeds limit {MAX_BATCH_SIZE}"
        )

    batch_id = _compute_batch_id(scenarios)

    # Check idempotency: filter metadata for existing batch_id
    existing_resp = (
        supabase
        .table("revenue_events")
        .select("id")
        .filter("metadata->>batch_id", "eq", batch_id)
        .limit(1)
        .execute()
    )
    if existing_resp.data:
        return _load_existing_batch_results(batch_id, scenarios)

    # Execute each scenario through the real pipeline
    results = []
    total_at_risk = 0.0
    total_recovered = 0.0
    total_recoveries = 0
    total_eligible = 0
    total_blocked = 0
    total_pending = 0
    total_executed = 0
    total_intervention_cost = 0.0
    total_interventions = 0

    for i, scenario in enumerate(scenarios):
        event = dict(scenario["event"])
        customer = dict(scenario["customer"])

        total_at_risk += float(event.get("amount", 0))

        # Mark as batch event via metadata
        event["_batch_id"] = batch_id
        event["_batch_index"] = i
        event["_batch_name"] = scenario["name"]

        try:
            recovery_result = process_recovery_event(event, customer)

            # Annotate the revenue event with batch metadata
            re = recovery_result.get("revenue_event")
            if re and re.get("id"):
                try:
                    supabase.table("revenue_events").update(
                        {                        "metadata": {
                            **(re.get("metadata") or {}),
                            "batch_id": batch_id,
                            "batch_index": i,
                            "batch_name": scenario["name"],
                            "batch_event_id": event["event_id"],
                            "batch_environment": "SIMULATED",
                        }}
                    ).eq("id", re["id"]).execute()
                except Exception:
                    pass

            action = recovery_result.get("action", {})
            decision = recovery_result.get("decision", {})
            rr = recovery_result.get("recovery_result", {})

            action_status = action.get("status", "unknown") if action else "unknown"
            decision_status = decision.get("status", "unknown") if decision else "unknown"
            recovered_amount = float(rr.get("recovered_amount", 0)) if rr else 0.0
            success = (rr.get("success", False) if rr else False) and recovered_amount > 0

            # --- Promise-to-Pay case: create + partially pay via promise_service ---
            promise_info = None
            if event.get("event_id") == "batch_12i_promise_1":
                promise = _execute_batch_promise(batch_id)
                promise_paid = float(promise.get("amount_paid", 0))
                if promise_paid > 0:
                    # The promise partial payment is the genuine recovery amount
                    recovered_amount = promise_paid
                    success = True
                    action_status = "success"
                promise_info = {
                    "promise_ref": promise.get("promise_ref"),
                    "invoice_ref": promise.get("invoice_ref"),
                    "promised_amount": float(promise.get("promised_amount", 0)),
                    "amount_paid": promise_paid,
                    "remaining": float(promise.get("promised_amount", 0)) - promise_paid,
                    "status": promise.get("status"),
                }

            if decision_status == "approved":
                total_eligible += 1
            if action_status == "blocked":
                total_blocked += 1
            if action_status == "pending_customer_action":
                total_pending += 1
            if action_status in {"success", "failed", "escalated"}:
                total_executed += 1
                total_interventions += 1
                total_intervention_cost += 0.50
            if success:
                total_recoveries += 1
                total_recovered += recovered_amount

            results.append({
                "index": i,
                "name": scenario["name"],
                "event_id": event["event_id"],
                "event_type": event.get("event_type", ""),
                "amount": float(event.get("amount", 0)),
                "diagnosis": recovery_result.get("diagnosis"),
                "decision_status": decision_status,
                "recommended_action": (
                    decision.get("recommended_action") if decision else None
                ),
                "action_status": action_status,
                "recovered": success,
                "recovered_amount": recovered_amount,
                "revenue_event_id": re.get("id") if re else None,
                "audit_logged": recovery_result.get("audit_log") is not None,
                "promise": promise_info,
            })

        except Exception as e:
            total_blocked += 1
            results.append({
                "index": i,
                "name": scenario["name"],
                "event_id": event["event_id"],
                "event_type": event.get("event_type", ""),
                "amount": float(event.get("amount", 0)),
                "diagnosis": None,
                "decision_status": "error",
                "recommended_action": None,
                "action_status": "error",
                "recovered": False,
                "recovered_amount": 0.0,
                "revenue_event_id": None,
                "audit_logged": False,
                "error": str(e),
            })

    recovery_rate = (
        total_recoveries / total_eligible
        if total_eligible > 0
        else 0.0
    )

    net_recovery = total_recovered - total_intervention_cost

    return {
        "batch_id": batch_id,
        "status": "completed",
        "environment": "SIMULATED",
        "label": "SIMULATED BATCH — Test Mode",
        "cases_processed": len(results),
        "total_amount_at_risk": round(total_at_risk, 2),
        "total_amount_recovered": round(total_recovered, 2),
        "recovery_rate": round(recovery_rate, 4),
        "recovery_rate_denominator": total_eligible,
        "eligible_interventions": total_eligible,
        "blocked_actions": total_blocked,
        "pending_customer_action": total_pending,
        "actions_executed": total_executed,
        "intervention_cost_per_action": 0.50,
        "total_intervention_cost": round(total_intervention_cost, 2),
        "net_recovery": round(net_recovery, 2),
        "cases": results,
    }


def _load_existing_batch_results(batch_id: str, scenarios: list[dict]) -> dict:
    """Load results for an already-executed batch by querying persisted records in bulk."""
    events_resp = (
        supabase
        .table("revenue_events")
        .select("id, event_type, amount, status, metadata, created_at")
        .filter("metadata->>batch_id", "eq", batch_id)
        .execute()
    )

    batch_events = events_resp.data or []
    ev_ids = [ev["id"] for ev in batch_events]

    # Bulk fetch diagnoses
    diagnoses = {}
    if ev_ids:
        diag_resp = supabase.table("diagnoses").select("revenue_event_id, category").in_("revenue_event_id", ev_ids).execute()
        for d in (diag_resp.data or []):
            if d.get("revenue_event_id"):
                diagnoses[d["revenue_event_id"]] = d

    # Bulk fetch decisions
    decisions = {}
    dec_id_to_rev_id = {}
    if ev_ids:
        dec_resp = supabase.table("decisions").select("id, revenue_event_id, recommended_action, status").in_("revenue_event_id", ev_ids).execute()
        for d in (dec_resp.data or []):
            if d.get("revenue_event_id"):
                decisions[d["revenue_event_id"]] = d
                dec_id_to_rev_id[d["id"]] = d["revenue_event_id"]

    # Bulk fetch actions
    actions_by_revid = {}
    action_ids = []
    if dec_id_to_rev_id:
        act_resp = supabase.table("actions").select("id, decision_id, status").in_("decision_id", list(dec_id_to_rev_id.keys())).execute()
        for a in (act_resp.data or []):
            rev_id = dec_id_to_rev_id.get(a.get("decision_id"))
            if rev_id:
                actions_by_revid[rev_id] = a
                action_ids.append(a["id"])

    # Bulk fetch recovery results
    recovery_results = {}
    if action_ids:
        rr_resp = supabase.table("recovery_results").select("action_id, success, recovered_amount").in_("action_id", action_ids).execute()
        for rr in (rr_resp.data or []):
            if rr.get("action_id"):
                recovery_results[rr["action_id"]] = rr

    total_at_risk = 0.0
    total_recovered = 0.0
    total_recoveries = 0
    total_eligible = 0
    total_blocked = 0
    total_pending = 0
    total_executed = 0
    total_interventions = 0
    results = []

    index_to_event_id = {
        i: s["event"]["event_id"] for i, s in enumerate(scenarios)
    }

    for ev in batch_events:
        meta = ev.get("metadata") or {}
        i = meta.get("batch_index", 0)
        name = meta.get("batch_name", f"Case {i}")
        amt = float(ev.get("amount", 0))
        total_at_risk += amt

        dec = decisions.get(ev["id"])
        action_result = {"status": "unknown", "action": None}
        rr_result = {"success": False, "recovered_amount": 0.0}

        if dec:
            if dec.get("status") == "approved":
                total_eligible += 1
            elif dec.get("status") == "blocked":
                total_blocked += 1

            act = actions_by_revid.get(ev["id"])
            if act:
                action_result = act
                act_status = act.get("status", "unknown")

                if act_status in {"success", "failed", "escalated"}:
                    total_executed += 1
                    total_interventions += 1
                if act_status == "pending_customer_action":
                    total_pending += 1
                if act_status == "blocked":
                    total_blocked += 1

                rr = recovery_results.get(act["id"])
                if rr:
                    rr_result = rr
                    if rr.get("success") and float(rr.get("recovered_amount", 0)) > 0:
                        total_recoveries += 1
                        total_recovered += float(rr["recovered_amount"])

        diagnosis = diagnoses.get(ev["id"])

        # --- Promise-to-Pay case: ensure + load from persisted promise service ---
        promise_info = None
        if ev.get("event_type") == "b2b.receivable.overdue" and (
            str(meta.get("batch_index", "")) == "9"
            or meta.get("batch_event_id") == "batch_12i_promise_1"
            or (ev.get("amount") and float(ev.get("amount")) == 50000.0)
        ):
            try:
                _execute_batch_promise(batch_id)
            except Exception:
                pass
            promise = _load_batch_promise()
            if promise:
                promise_paid = float(promise.get("amount_paid", 0))
                if promise_paid > 0:
                    total_pending -= 1
                    total_recoveries += 1
                    total_recovered += promise_paid
                    total_executed += 1
                    total_interventions += 1
                promise_info = {
                    "promise_ref": promise.get("promise_ref"),
                    "invoice_ref": promise.get("invoice_ref"),
                    "promised_amount": float(promise.get("promised_amount", 0)),
                    "amount_paid": promise_paid,
                    "remaining": float(promise.get("promised_amount", 0)) - promise_paid,
                    "status": promise.get("status"),
                }

        results.append({
            "index": i,
            "name": name,
            "event_id": (
                meta.get("batch_event_id")
                or index_to_event_id.get(i)
                or ev["id"]
            ),
            "event_type": ev.get("event_type", ""),
            "amount": amt,
            "diagnosis": diagnosis.get("category") if diagnosis else None,
            "decision_status": dec.get("status") if dec else "unknown",
            "recommended_action": dec.get("recommended_action") if dec else None,
            "action_status": action_result.get("status", "unknown"),
            "recovered": (
                bool(promise_info and float(promise_info.get("amount_paid", 0)) > 0)
            )
            if promise_info
            else (
                rr_result.get("success", False)
                and float(rr_result.get("recovered_amount", 0)) > 0
            ),
            "recovered_amount": (
                float(promise_info.get("amount_paid", 0))
                if promise_info
                else float(rr_result.get("recovered_amount", 0))
            ),
            "revenue_event_id": ev["id"],
            "audit_logged": True,
            "promise": promise_info,
        })

    recovery_rate = (
        total_recoveries / total_eligible
        if total_eligible > 0
        else 0.0
    )

    total_intervention_cost = total_interventions * 0.50
    net_recovery = total_recovered - total_intervention_cost

    results.sort(key=lambda r: r.get("index", 0))

    return {
        "batch_id": batch_id,
        "status": "completed",
        "environment": "SIMULATED",
        "label": "SIMULATED BATCH — Test Mode (cached)",
        "cases_processed": len(results),
        "total_amount_at_risk": round(total_at_risk, 2),
        "total_amount_recovered": round(total_recovered, 2),
        "recovery_rate": round(recovery_rate, 4),
        "recovery_rate_denominator": total_eligible,
        "eligible_interventions": total_eligible,
        "blocked_actions": total_blocked,
        "pending_customer_action": total_pending,
        "actions_executed": total_executed,
        "intervention_cost_per_action": 0.50,
        "total_intervention_cost": round(total_intervention_cost, 2),
        "net_recovery": round(net_recovery, 2),
        "cases": results,
        "cached": True,
    }
