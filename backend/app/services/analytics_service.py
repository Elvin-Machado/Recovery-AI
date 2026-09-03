from app.database import supabase
from app.services.promise_service import promise_service

# ---------------------------------------------------------
# ECONOMIC MODEL CONSTANTS
# ---------------------------------------------------------

INTERVENTION_COST_PER_ACTION = 0.50  # INR — simulation/economic assumption

# ---------------------------------------------------------
# SOURCE CLASSIFICATION
# ---------------------------------------------------------

_SOURCE_MAP = {
    "payment.failed":                "payment_failure",
    "payment_failed":                "payment_failure",
    "subscription.charged.failed":   "subscription",
    "subscription_failed":           "subscription",
    "checkout.abandoned":            "checkout",
    "checkout_abandoned":            "checkout",
    "b2b.receivable.overdue":        "b2b_receivable",
    "promise.broken":                "promise",
}

_AI_EVALUATED_DIAGNOSES = {
    "soft_decline", "temporary_failure", "payment_method_expired",
    "hard_decline", "risk_block", "mandate_revoked", "unknown_failure",
}


def _classify_source(event_type: str) -> str:
    if not event_type:
        return "unknown"
    return _SOURCE_MAP.get(event_type, "unknown")


def _is_ai_evaluated(category: str | None) -> bool:
    return bool(category and category in _AI_EVALUATED_DIAGNOSES)


# ---------------------------------------------------------
# BATCH DATA LOADING — avoids N+1 queries
# ---------------------------------------------------------

def _load_all():
    """Load all data in bulk, return pre-joined structures."""
    events = (
        supabase.table("revenue_events")
        .select("id, event_type, amount, status, created_at")
        .execute()
    ).data or []

    diagnoses_list = (
        supabase.table("diagnoses")
        .select("revenue_event_id, category, confidence, model_version")
        .execute()
    ).data or []
    diagnoses = {d["revenue_event_id"]: d for d in diagnoses_list if d.get("revenue_event_id")}

    decisions_list = (
        supabase.table("decisions")
        .select("revenue_event_id, id, recommended_action, status")
        .execute()
    ).data or []
    decisions = {}
    decision_id_to_revid = {}
    for d in decisions_list:
        revid = d.get("revenue_event_id")
        if revid:
            decisions[revid] = d
            decision_id_to_revid[d["id"]] = revid

    # Load ALL actions in one query
    actions_list = (
        supabase.table("actions")
        .select("id, decision_id, status")
        .execute()
    ).data or []
    actions_by_revid: dict[str, list[dict]] = {}
    action_ids = []
    for a in actions_list:
        revid = decision_id_to_revid.get(a.get("decision_id"))
        if revid:
            actions_by_revid.setdefault(revid, []).append(a)
            action_ids.append(a["id"])

    # Load ALL recovery results in one query
    recovery_results: dict[str, dict] = {}
    if action_ids:
        # Supabase .in_ has a limit, batch in chunks of 500
        for i in range(0, len(action_ids), 500):
            chunk = action_ids[i:i+500]
            rr_list = (
                supabase.table("recovery_results")
                .select("action_id, success, recovered_amount, result_code")
                .in_("action_id", chunk)
                .execute()
            ).data or []
            for rr in rr_list:
                recovery_results[rr["action_id"]] = rr

    # Promises: load through the authoritative promise_service source.
    # The promises table is standalone (Phase 12H) and may live in the DB or in
    # promise_service's persistence layer; using the service keeps analytics
    # consistent with the actual persisted/recorded promise state without a
    # separate (and possibly unavailable) DDL/schema dependency.
    promises = []
    try:
        promises = promise_service.get_all() or []
    except Exception:
        promises = []

    return events, diagnoses, decisions, actions_by_revid, recovery_results, promises


# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------

def compute_summary() -> dict:
    events, diagnoses, decisions, actions_by_revid, recovery_results, promises = _load_all()

    total_at_risk = sum(float(ev["amount"]) for ev in events)
    total_at_risk += sum(
        float(p["promised_amount"]) - float(p.get("amount_paid", 0))
        for p in promises
        if p.get("status") in {"PROMISE_PENDING", "PARTIALLY_FULFILLED", "BROKEN", "ESCALATED"}
    )

    ai_evaluated = 0
    det_evaluated = 0
    eligible = 0
    blocked = 0
    pending = 0
    executed = 0
    recovered = 0
    amount_recovered = 0.0

    for ev in events:
        eid = ev["id"]
        diag = diagnoses.get(eid)
        dec = decisions.get(eid)
        acts = actions_by_revid.get(eid, [])

        if diag:
            if _is_ai_evaluated(diag.get("category")):
                ai_evaluated += 1
            else:
                det_evaluated += 1

        if dec:
            if dec.get("status") == "approved":
                eligible += 1
            elif dec.get("status") == "blocked":
                blocked += 1

        for act in acts:
            s = act.get("status", "")
            if s in {"success", "failed", "escalated"}:
                executed += 1
            if s == "pending_customer_action":
                pending += 1
            if s == "blocked":
                blocked += 1

            rr = recovery_results.get(act["id"])
            if rr and rr.get("success") and float(rr.get("recovered_amount", 0)) > 0:
                recovered += 1
                amount_recovered += float(rr["recovered_amount"])

    promise_recovered = 0
    promise_amount_recovered = 0.0
    for p in promises:
        det_evaluated += 1  # promises follow deterministic/policy evaluation
        if p.get("status") == "FULFILLED":
            promise_recovered += 1
            promise_amount_recovered += float(p.get("amount_paid", 0))
        elif p.get("status") == "PARTIALLY_FULFILLED":
            promise_amount_recovered += float(p.get("amount_paid", 0))

    total_recovered = recovered + promise_recovered
    total_amount_recovered = amount_recovered + promise_amount_recovered

    intervention_count = executed
    total_intervention_cost = intervention_count * INTERVENTION_COST_PER_ACTION
    net_recovery = total_amount_recovered - total_intervention_cost

    recovery_rate = total_recovered / eligible if eligible > 0 else 0.0
    economic_efficiency = net_recovery / total_intervention_cost if total_intervention_cost > 0 else 0.0

    return {
        "total_cases": len(events) + len(promises),
        "total_amount_at_risk": round(total_at_risk, 2),
        "ai_evaluated": ai_evaluated,
        "deterministic_evaluated": det_evaluated,
        "eligible_interventions": eligible,
        "blocked_actions": blocked,
        "pending_customer_action": pending,
        "actions_executed": executed,
        "successful_recoveries": total_recovered,
        "total_amount_recovered": round(total_amount_recovered, 2),
        "recovery_rate": round(recovery_rate, 4),
        "recovery_rate_denominator": eligible,
        "intervention_cost_per_action": INTERVENTION_COST_PER_ACTION,
        "total_intervention_cost": round(total_intervention_cost, 2),
        "net_recovery": round(net_recovery, 2),
        "economic_efficiency": round(economic_efficiency, 4),
        "environment": "SIMULATED",
    }


# ---------------------------------------------------------
# CATEGORY BREAKDOWN
# ---------------------------------------------------------

def _init_cat(name):
    return {
        "name": name, "cases": 0, "amount_at_risk": 0.0,
        "eligible": 0, "blocked": 0, "pending": 0, "executed": 0,
        "recovered": 0, "amount_recovered": 0.0, "recovery_rate": 0.0,
        "ai_evaluated": 0, "deterministic_evaluated": 0,
    }


def compute_category_breakdown() -> list[dict]:
    events, diagnoses, decisions, actions_by_revid, recovery_results, promises = _load_all()

    cats = {
        "payment_failure": _init_cat("Payment Failure"),
        "checkout": _init_cat("Checkout Abandonment"),
        "subscription": _init_cat("Failed Subscription"),
        "b2b_receivable": _init_cat("B2B Receivable"),
        "promise": _init_cat("Promise-to-Pay"),
        "unknown": _init_cat("Unknown Source"),
    }

    for ev in events:
        source = _classify_source(ev.get("event_type", ""))
        cat = cats.get(source, cats["unknown"])

        cat["cases"] += 1
        cat["amount_at_risk"] += float(ev.get("amount", 0))

        eid = ev["id"]
        diag = diagnoses.get(eid)
        dec = decisions.get(eid)

        if dec:
            if dec.get("status") == "approved":
                cat["eligible"] += 1
            elif dec.get("status") == "blocked":
                cat["blocked"] += 1

        for act in actions_by_revid.get(eid, []):
            s = act.get("status", "")
            if s == "pending_customer_action":
                cat["pending"] += 1
            elif s in {"success", "failed", "escalated"}:
                cat["executed"] += 1
            elif s == "blocked":
                cat["blocked"] += 1

            rr = recovery_results.get(act["id"])
            if rr and rr.get("success") and float(rr.get("recovered_amount", 0)) > 0:
                cat["recovered"] += 1
                cat["amount_recovered"] += float(rr["recovered_amount"])

        if diag:
            if _is_ai_evaluated(diag.get("category")):
                cat["ai_evaluated"] += 1
            else:
                cat["deterministic_evaluated"] += 1

    # Promises
    pcat = cats["promise"]
    for p in promises:
        pcat["cases"] += 1
        promised = float(p.get("promised_amount", 0))
        paid = float(p.get("amount_paid", 0))
        status = p.get("status", "")
        if status == "FULFILLED":
            pcat["amount_at_risk"] += max(promised - paid, 0)
        elif status == "PARTIALLY_FULFILLED":
            pcat["amount_at_risk"] += max(promised - paid, 0)
        else:
            # PROMISE_PENDING / BROKEN / ESCALATED / CANCELLED — full amount still
            # outstanding (or fully at risk where not recoverable yet)
            pcat["amount_at_risk"] += promised if status not in {"CANCELLED"} else 0.0
        if status == "FULFILLED":
            pcat["recovered"] += 1
            pcat["amount_recovered"] += paid
            pcat["executed"] += 1
        elif status == "PARTIALLY_FULFILLED":
            pcat["amount_recovered"] += paid
            pcat["pending"] += 1
            pcat["executed"] += 1
        elif status in {"PROMISE_PENDING", "ESCALATED"}:
            pcat["eligible"] += 1
            pcat["executed"] += 1
        elif status == "BROKEN":
            pcat["eligible"] += 1
            pcat["executed"] += 1
        elif status == "CANCELLED":
            pcat["blocked"] += 1
        pcat["deterministic_evaluated"] += 1

    result = []
    for key in ["payment_failure", "checkout", "subscription", "b2b_receivable", "promise", "unknown"]:
        c = cats[key]
        c["amount_at_risk"] = round(c["amount_at_risk"], 2)
        c["amount_recovered"] = round(c["amount_recovered"], 2)
        c["recovery_rate"] = round(c["recovered"] / c["eligible"], 4) if c["eligible"] > 0 else 0.0
        result.append(c)

    return result


def get_model_benchmark() -> dict:
    return {
        "label": "Recovery model benchmark — synthetic validation dataset",
        "roc_auc": 0.808,
        "pr_auc": 0.628,
        "brier_score": 0.152,
        "note": "These are NOT real production metrics. They represent "
                "synthetic benchmark results from Phase 12A validation.",
    }
