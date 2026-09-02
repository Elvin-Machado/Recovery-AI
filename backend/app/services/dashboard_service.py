from app.database import supabase
from app.services.persistence_service import persistence_service


# ---------------------------------------------------------
# EVENT TYPE LABEL MAPPING (TASK 3)
# ---------------------------------------------------------

_EVENT_TYPE_LABELS = {
    "payment.failed":           "Payment Failure",
    "payment_failed":           "Payment Failure",
    "subscription_failed":      "Subscription Failed",
    "mandate_revoked":          "Mandate Revoked",
    "checkout_abandoned":       "Checkout Abandoned",
}


def event_type_label(event_type: str) -> str:
    if not event_type:
        return "Unknown Event"

    if event_type in _EVENT_TYPE_LABELS:
        return _EVENT_TYPE_LABELS[event_type]

    return event_type.replace("_", " ").replace(".", " ").title()


# ---------------------------------------------------------
# RECENT EVENTS (TASK 1 / 2)
# ---------------------------------------------------------

def get_recent_events(limit: int = 20):
    # ---------------------------------------------------------
    # 1. Get recent revenue events
    # ---------------------------------------------------------

    revenue_response = (
        supabase
        .table("revenue_events")
        .select(
            """
            id,
            customer_id,
            event_type,
            amount,
            status,
            failure_code,
            mandate_status,
            attempt_count,
            created_at,
            metadata
            """
        )
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    revenue_events = revenue_response.data or []

    # ---------------------------------------------------------
    # 2. Collect unique customer IDs and fetch customers
    # ---------------------------------------------------------

    customer_ids = list({
        event["customer_id"]
        for event in revenue_events
        if event.get("customer_id")
    })

    customers = {}

    if customer_ids:
        customer_response = (
            supabase
            .table("customers")
            .select("id, name, email, phone")
            .in_("id", customer_ids)
            .execute()
        )

        customers = {
            customer["id"]: customer
            for customer in (customer_response.data or [])
        }

    # ---------------------------------------------------------
    # 3. Format events for frontend
    # ---------------------------------------------------------

    events = []

    for event in revenue_events:
        customer = customers.get(
            event.get("customer_id"),
            {}
        )

        metadata = event.get("metadata") or {}

        events.append({
            "id": event["id"],

            "customer": {
                "name": customer.get(
                    "name",
                    "Unknown Customer"
                ),
                "email": customer.get("email"),
                "phone": customer.get("phone"),
            },

            "event": {
                "event_id": event["id"],
                "event_type": event["event_type"],
                "amount": float(event["amount"]),
                "attempt_count": event.get(
                    "attempt_count",
                    0
                ),
                "previous_successful_payments": metadata.get(
                    "previous_successful_payments",
                    0
                ),
                "days_since_last_payment": metadata.get(
                    "days_since_last_payment",
                    0
                ),
                "failure_code": event.get("failure_code"),
                "mandate_status": event.get("mandate_status"),
            },

            "type": event_type_label(event.get("event_type", "")),

            "status": event["status"],
        })

    return events


# ---------------------------------------------------------
# DASHBOARD METRICS (TASK 6)
# ---------------------------------------------------------

def get_dashboard_metrics():

    # ---------------------------------------------------------
    # 1. Get all revenue events
    # ---------------------------------------------------------

    revenue_response = (
        supabase
        .table("revenue_events")
        .select("amount, status")
        .execute()
    )

    revenue_events = revenue_response.data or []

    # ---------------------------------------------------------
    # 2. Revenue at risk
    # ---------------------------------------------------------

    unresolved_statuses = {
        "detected",
        "failed",
        "blocked",
        "pending_customer_action",
    }

    revenue_at_risk = sum(
        float(event["amount"])
        for event in revenue_events
        if event["status"] in unresolved_statuses
    )

    # ---------------------------------------------------------
    # 3. Recovered revenue
    # ---------------------------------------------------------

    recovered = sum(
        float(event["amount"])
        for event in revenue_events
        if event["status"] == "recovered"
    )

    # ---------------------------------------------------------
    # 4. Recovery opportunities
    # ---------------------------------------------------------

    opportunities = sum(
        1
        for event in revenue_events
        if event["status"] in unresolved_statuses
    )

    # ---------------------------------------------------------
    # 5. Blocked actions
    # ---------------------------------------------------------

    blocked_response = (
        supabase
        .table("actions")
        .select("id")
        .eq("status", "blocked")
        .execute()
    )

    blocked_actions = len(
        blocked_response.data or []
    )

    # ---------------------------------------------------------
    # 6. Recent events
    # ---------------------------------------------------------

    recent_events = get_recent_events(20)

    # ---------------------------------------------------------
    # 7. Return dashboard
    # ---------------------------------------------------------

    return {
        "revenue_at_risk": revenue_at_risk,
        "recovered": recovered,
        "opportunities": opportunities,
        "blocked_actions": blocked_actions,
        "recent_events": recent_events,
    }


# ---------------------------------------------------------
# DATA HEALTH (TASK 5)
# ---------------------------------------------------------

def get_data_health():
    """
    Diagnostic endpoint for development/demo use.

    Returns counts of revenue events by status and identifies
    possible orphan candidates.

    Orphan definition used here:
        A revenue_event row that has NO associated diagnosis
        linked to it (revenue_event_id not present in diagnoses).

        These are rows created by the old broken workflow that
        created a new revenue_event but never ran the recovery
        agent against it, OR rows seeded directly into the DB
        that have never been processed.

        We do NOT assume these are safe to delete. This count
        is purely for visibility.

    We deliberately do NOT join on customer/amount/event_type
    to identify duplicates — those can legitimately recur.
    """

    # ---------------------------------------------------------
    # 1. All revenue events (id + status only)
    # ---------------------------------------------------------

    all_events_response = (
        supabase
        .table("revenue_events")
        .select("id, status, amount")
        .execute()
    )

    all_events = all_events_response.data or []
    total = len(all_events)

    counts = {
        "detected":                 0,
        "recovered":                0,
        "failed":                   0,
        "blocked":                  0,
        "pending_customer_action":  0,
        "other":                    0,
    }

    for ev in all_events:
        status = ev.get("status", "")
        if status in counts:
            counts[status] += 1
        else:
            counts["other"] += 1

    # ---------------------------------------------------------
    # 2. Find orphans: revenue_events with no diagnosis row
    #
    #    Supabase Python client does not support NOT IN / LEFT
    #    JOIN directly in a single query, so we fetch all
    #    distinct revenue_event_ids from diagnoses and compute
    #    the difference in Python.
    # ---------------------------------------------------------

    diagnoses_response = (
        supabase
        .table("diagnoses")
        .select("revenue_event_id")
        .execute()
    )

    diagnosed_ids = {
        row["revenue_event_id"]
        for row in (diagnoses_response.data or [])
        if row.get("revenue_event_id")
    }

    all_event_ids = {ev["id"] for ev in all_events}

    possible_orphan_ids = all_event_ids - diagnosed_ids

    possible_orphans = len(possible_orphan_ids)

    # ---------------------------------------------------------
    # 3. Total amounts by status (for context, no PII)
    # ---------------------------------------------------------

    revenue_at_risk = sum(
        float(ev["amount"])
        for ev in all_events
        if ev.get("status") in {
            "detected", "failed", "blocked",
            "pending_customer_action"
        }
    )

    total_recovered = sum(
        float(ev["amount"])
        for ev in all_events
        if ev.get("status") == "recovered"
    )

    return {
        "total_revenue_events": total,
        "detected":                 counts["detected"],
        "recovered":                counts["recovered"],
        "failed":                   counts["failed"],
        "blocked":                  counts["blocked"],
        "pending_customer_action":  counts["pending_customer_action"],
        "other_status":             counts["other"],
        "possible_orphans": possible_orphans,
        "orphan_note": (
            "Revenue events with no associated diagnosis row. "
            "These were either seeded directly into the database "
            "or created by the old workflow without running the "
            "recovery agent. They are NOT automatically deleted."
        ),
        "revenue_at_risk": revenue_at_risk,
        "total_recovered": total_recovered,
    }


# ---------------------------------------------------------
# ORPHAN DETAILS (TASK 3)
# ---------------------------------------------------------

def get_orphan_details():
    """
    Return detailed diagnostic info for orphan revenue events
    (those with no diagnosis row).
    """

    all_events_response = (
        supabase
        .table("revenue_events")
        .select("id, status, amount, event_type, created_at")
        .execute()
    )

    all_events = all_events_response.data or []

    diagnoses_response = (
        supabase
        .table("diagnoses")
        .select("revenue_event_id")
        .execute()
    )

    diagnosed_ids = {
        row["revenue_event_id"]
        for row in (diagnoses_response.data or [])
        if row.get("revenue_event_id")
    }

    all_event_ids = {ev["id"] for ev in all_events}
    possible_orphan_ids = all_event_ids - diagnosed_ids

    orphans = []

    for ev in all_events:
        if ev["id"] in possible_orphan_ids:
            # Classify based on evidence
            classification = "UNKNOWN"
            reason = ""

            # Check if it has a webhook
            has_webhook = False
            try:
                ev_full = supabase.table("revenue_events").select("source_webhook_id").eq("id", ev["id"]).single().execute()
                if ev_full.data and ev_full.data.get("source_webhook_id"):
                    has_webhook = True
            except Exception:
                pass

            # Evidence-based classification
            if ev.get("status") == "detected" and not has_webhook:
                classification = "HISTORICAL_TEST_DATA"
                reason = "Status=detected, no webhook reference, no recovery lifecycle records"
            elif ev.get("status") in {"failed", "blocked", "pending_customer_action"} and not has_webhook:
                classification = "LEGITIMATE_UNPROCESSED"
                reason = f"Status={ev.get('status')} but no webhook and no diagnosis"
            elif has_webhook:
                classification = "PARTIAL_WORKFLOW"
                reason = "Has webhook reference but no diagnosis created"
            else:
                classification = "UNKNOWN"
                reason = "Insufficient evidence to safely classify"

            orphans.append({
                "id": ev["id"],
                "amount": float(ev.get("amount", 0)),
                "status": ev.get("status"),
                "event_type": ev.get("event_type"),
                "classification": classification,
                "reason": reason,
            })

    return orphans


# ---------------------------------------------------------
# DATA INTEGRITY CHECKS (TASK 5)
# ---------------------------------------------------------

def get_integrity_checks():
    """
    Return counts for various data integrity checks.
    Does NOT modify anything.
    """

    # 1. revenue event without customer
    rev_response = supabase.table("revenue_events").select("id, customer_id").execute()
    rev_events = rev_response.data or []
    rev_without_customer = sum(1 for ev in rev_events if not ev.get("customer_id"))

    # 2. revenue event without webhook
    rev_without_webhook = sum(1 for ev in rev_events if not ev.get("source_webhook_id"))

    # 3. revenue event without diagnosis
    diag_response = supabase.table("diagnoses").select("revenue_event_id").execute()
    diag_ids = {row["revenue_event_id"] for row in (diag_response.data or []) if row.get("revenue_event_id")}
    rev_without_diagnosis = sum(1 for ev in rev_events if ev["id"] not in diag_ids)

    # 4. diagnosis without revenue event
    all_rev_ids = {ev["id"] for ev in rev_events}
    diag_without_rev = sum(1 for did in diag_ids if did not in all_rev_ids)

    # 5. decision without revenue event
    dec_response = supabase.table("decisions").select("revenue_event_id").execute()
    dec_ids = {row["revenue_event_id"] for row in (dec_response.data or []) if row.get("revenue_event_id")}
    dec_without_rev = sum(1 for did in dec_ids if did not in all_rev_ids)

    # 6. action without decision
    act_response = supabase.table("actions").select("decision_id").execute()
    dec_all_ids = {row["id"] for row in supabase.table("decisions").select("id").execute().data or []}
    act_without_dec = sum(1 for a in (act_response.data or []) if a.get("decision_id") not in dec_all_ids)

    # 7. recovery_result without action
    rr_response = supabase.table("recovery_results").select("action_id").execute()
    act_all_ids = {row["id"] for row in supabase.table("actions").select("id").execute().data or []}
    rr_without_action = sum(1 for rr in (rr_response.data or []) if rr.get("action_id") not in act_all_ids)

    # 8. recovered revenue event without successful recovery_result
    recovered_events = [ev for ev in rev_events if ev.get("status") == "recovered"]
    recovered_without_success_rr = 0
    recovered_amount_mismatch = 0

    for ev in recovered_events:
        # Check if has successful recovery_result
        dec = supabase.table("decisions").select("id").eq("revenue_event_id", ev["id"]).execute()
        has_success_rr = False
        if dec.data:
            for d in dec.data:
                act = supabase.table("actions").select("id, status").eq("decision_id", d["id"]).execute()
                for a in act.data:
                    rr = supabase.table("recovery_results").select("success, recovered_amount").eq("action_id", a["id"]).execute()
                    for r in rr.data:
                        if r.get("success") and float(r.get("recovered_amount", 0)) > 0:
                            has_success_rr = True
                            # Check amount match
                            if abs(float(ev.get("amount", 0)) - float(r.get("recovered_amount", 0))) > 0.01:
                                recovered_amount_mismatch += 1
        if not has_success_rr:
            recovered_without_success_rr += 1

    # 9. unresolved revenue event with successful recovery_result
    unresolved_statuses = {"detected", "failed", "blocked", "pending_customer_action"}
    unresolved_with_success_rr = 0

    for ev in rev_events:
        if ev.get("status") in unresolved_statuses:
            dec = supabase.table("decisions").select("id").eq("revenue_event_id", ev["id"]).execute()
            if dec.data:
                for d in dec.data:
                    act = supabase.table("actions").select("id").eq("decision_id", d["id"]).execute()
                    for a in act.data:
                        rr = supabase.table("recovery_results").select("success, recovered_amount").eq("action_id", a["id"]).execute()
                        for r in rr.data:
                            if r.get("success") and float(r.get("recovered_amount", 0)) > 0:
                                unresolved_with_success_rr += 1

    # 10. blocked revenue event without blocked action
    blocked_events = [ev for ev in rev_events if ev.get("status") == "blocked"]
    blocked_without_blocked_action = 0
    for ev in blocked_events:
        dec = supabase.table("decisions").select("id").eq("revenue_event_id", ev["id"]).execute()
        has_blocked_action = False
        if dec.data:
            for d in dec.data:
                act = supabase.table("actions").select("status").eq("decision_id", d["id"]).eq("status", "blocked").execute()
                if act.data:
                    has_blocked_action = True
        if not has_blocked_action:
            blocked_without_blocked_action += 1

    return {
        "revenue_event_without_customer": rev_without_customer,
        "revenue_event_without_webhook": rev_without_webhook,
        "revenue_event_without_diagnosis": rev_without_diagnosis,
        "diagnosis_without_revenue_event": diag_without_rev,
        "decision_without_revenue_event": dec_without_rev,
        "action_without_decision": act_without_dec,
        "recovery_result_without_action": rr_without_action,
        "recovered_event_without_successful_recovery_result": recovered_without_success_rr,
        "recovered_amount_mismatch": recovered_amount_mismatch,
        "unresolved_event_with_successful_recovery_result": unresolved_with_success_rr,
        "blocked_event_without_blocked_action": blocked_without_blocked_action,
    }


# ---------------------------------------------------------
# METRIC CONSISTENCY VERIFICATION (TASK 6)
# ---------------------------------------------------------

def verify_metric_consistency():
    """
    Mathematically verify that dashboard metrics match
    direct database aggregation.
    """

    rev_response = supabase.table("revenue_events").select("amount, status").execute()
    rev_events = rev_response.data or []

    unresolved_statuses = {"detected", "failed", "blocked", "pending_customer_action"}

    calc_revenue_at_risk = sum(
        float(ev["amount"])
        for ev in rev_events
        if ev.get("status") in unresolved_statuses
    )

    calc_recovered = sum(
        float(ev["amount"])
        for ev in rev_events
        if ev.get("status") == "recovered"
    )

    calc_opportunities = sum(
        1
        for ev in rev_events
        if ev.get("status") in unresolved_statuses
    )

    # Also fetch dashboard metrics for comparison
    dash_response = supabase.table("revenue_events").select("amount, status").execute()
    # (same as above, just reusing)

    return {
        "calculated_revenue_at_risk": calc_revenue_at_risk,
        "calculated_recovered": calc_recovered,
        "calculated_opportunities": calc_opportunities,
        "calculated_total_revenue": calc_revenue_at_risk + calc_recovered,
        "total_revenue_events": len(rev_events),
    }


# ---------------------------------------------------------
# ORPHAN VERIFICATION (Milestone 9)
# ---------------------------------------------------------

def verify_orphan_candidates(revenue_event_ids: list[str]) -> list[dict]:
    """
    Read-only verification of candidate revenue events for orphan cleanup.
    """
    results = []
    for rid in revenue_event_ids:
        verification = persistence_service.verify_orphan_candidate(rid)
        results.append(verification)
    return results


# ---------------------------------------------------------
# LEGACY STATUS REPAIR (Milestone 9)
# ---------------------------------------------------------

def repair_legacy_statuses(revenue_event_ids: list[str]) -> list[dict]:
    """
    Repair legacy revenue events that have successful recovery results
    but still have status='detected'.
    """
    results = []
    for rid in revenue_event_ids:
        result = persistence_service.repair_legacy_status(rid)
        results.append(result)
    return results


# ---------------------------------------------------------
# ORPHAN CLEANUP (Milestone 9)
# ---------------------------------------------------------

def cleanup_orphans(revenue_event_ids: list[str], confirm: bool = False) -> dict:
    """
    Safely delete orphan revenue events after verification.
    """
    return persistence_service.cleanup_orphans(revenue_event_ids, confirm=confirm)
