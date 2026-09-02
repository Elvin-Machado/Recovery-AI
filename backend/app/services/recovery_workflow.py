from app.agents.recovery_agent import recovery_agent
from app.services.persistence_service import persistence_service


def _run_recovery_agent(event: dict) -> dict:
    return recovery_agent.process(
        {
            "amount": event["amount"],
            "attempt_count": event.get("attempt_count", 0),
            "previous_successful_payments": event.get(
                "previous_successful_payments", 0
            ),
            "days_since_last_payment": event.get(
                "days_since_last_payment", 0
            ),
            "failure_code": event.get("failure_code"),
        }
    )


def _persist_workflow(
    revenue_event: dict,
    event: dict,
    agent_result: dict,
) -> tuple:
    policy = agent_result["policy"]
    action_result = agent_result["action"]

    # Diagnosis
    diagnosis = persistence_service.create_diagnosis(
        revenue_event_id=revenue_event["id"],
        category=agent_result["diagnosis"],
        confidence=agent_result["recovery_probability"],
        reason=(
            f"Model predicted recovery probability "
            f"{agent_result['recovery_probability']:.4f}"
        ),
        model_version="recovery-model-v1",
    )

    # Decision
    decision_status = (
        "approved" if policy["allowed"] else "blocked"
    )

    decision = persistence_service.create_decision(
        revenue_event_id=revenue_event["id"],
        diagnosis_id=diagnosis["id"],
        recommended_action=agent_result["recommended_action"],
        confidence=agent_result["recovery_probability"],
        reason=policy["reason"],
        status=decision_status,
    )

    # Action
    action = persistence_service.create_action(
        decision_id=decision["id"],
        action_type=action_result["action"],
        status=action_result["status"],
        metadata={
            "failure_code": event.get("failure_code"),
            "attempt_count": event.get("attempt_count", 0),
            "policy_allowed": policy["allowed"],
            "policy_reason": policy["reason"],
        },
    )

    # Recovery result
    recovered_amount = action_result["amount_recovered"]
    success = (
        action_result["status"] == "success"
        and recovered_amount > 0
    )

    recovery_result = persistence_service.create_recovery_result(
        action_id=action["id"],
        success=success,
        recovered_amount=recovered_amount,
        result_code=action_result["status"],
    )

    return diagnosis, decision, action, recovery_result, success


def _revenue_status_from_action(action_result: dict, success: bool) -> str:
    if success:
        return "recovered"
    if action_result["status"] == "pending_customer_action":
        return "pending_customer_action"
    if action_result["status"] == "blocked":
        return "blocked"
    return "failed"


def _revenue_status_from_recovery_result(
    action: dict,
    recovery_result: dict,
) -> str:
    success = (
        recovery_result.get("success", False)
        and float(recovery_result.get("recovered_amount", 0)) > 0
    )
    if success:
        return "recovered"
    action_status = action.get("status", "")
    if action_status == "pending_customer_action":
        return "pending_customer_action"
    if action_status == "blocked":
        return "blocked"
    return "failed"


def process_recovery_event(event: dict, customer: dict) -> dict:
    """
    Runs one complete recovery workflow and persists
    every important stage to Supabase.

    CASE A — Existing revenue event (dashboard/demo event):
        event["event_id"] matches an existing revenue_events.id.
        Use that existing row. Do NOT create a new revenue_events row.
        If already fully processed → return duplicate.
        If unprocessed → run agent and persist against existing row.

    CASE B — New webhook event:
        event["event_id"] does not match any existing revenue_events.id.
        Create webhook, customer, revenue_event, run full workflow.

    CASE C — Duplicate real webhook (existing webhook + revenue_event):
        Detected inside Case B via get_revenue_event_by_webhook_id.
        Return existing workflow result, do not re-execute.
    """

    # ---------------------------------------------------------
    # CASE A — Check if event_id is an existing revenue_events.id
    # ---------------------------------------------------------

    existing_revenue_event = (
        persistence_service.get_revenue_event_by_id(
            event["event_id"]
        )
    )

    if existing_revenue_event:

        revenue_event_id = existing_revenue_event["id"]

        # Check how far the workflow has already progressed

        diagnosis = (
            persistence_service
            .get_diagnosis_by_revenue_event_id(revenue_event_id)
        )

        decision = (
            persistence_service
            .get_decision_by_revenue_event_id(revenue_event_id)
        )

        action = None
        recovery_result = None

        if decision:
            action = (
                persistence_service
                .get_action_by_decision_id(decision["id"])
            )

        if action:
            recovery_result = (
                persistence_service
                .get_recovery_result_by_action_id(action["id"])
            )

        # If fully processed → duplicate.
        # Also repair status if the previous run failed to update it.
        if recovery_result is not None:

            terminal_statuses = {
                "recovered",
                "failed",
                "blocked",
                "pending_customer_action",
            }

            if existing_revenue_event["status"] not in terminal_statuses:
                correct_status = _revenue_status_from_recovery_result(
                    action, recovery_result
                )
                existing_revenue_event = (
                    persistence_service.update_revenue_event_status(
                        revenue_event_id=revenue_event_id,
                        status=correct_status,
                    )
                )

            return {
                "revenue_event": existing_revenue_event,
                "diagnosis": diagnosis,
                "decision": decision,
                "action": action,
                "recovery_result": recovery_result,
                "audit_log": None,
                "duplicate": True,
            }

        # Not yet processed → run agent against existing revenue event
        agent_result = _run_recovery_agent(event)

        diagnosis, decision, action, recovery_result, success = (
            _persist_workflow(existing_revenue_event, event, agent_result)
        )

        revenue_status = _revenue_status_from_action(
            agent_result["action"], success
        )

        revenue_event = persistence_service.update_revenue_event_status(
            revenue_event_id=revenue_event_id,
            status=revenue_status,
        )

        audit_log = persistence_service.create_audit_log(
            revenue_event_id=revenue_event_id,
            action="recovery_workflow_completed",
            actor_type="recovery_agent",
            details={
                "diagnosis": agent_result["diagnosis"],
                "recovery_probability": agent_result[
                    "recovery_probability"
                ],
                "recommended_action": agent_result[
                    "recommended_action"
                ],
                "policy_allowed": agent_result["policy"]["allowed"],
                "policy_reason": agent_result["policy"]["reason"],
                "action_status": agent_result["action"]["status"],
                "amount_recovered": agent_result["action"][
                    "amount_recovered"
                ],
            },
        )

        return {
            "revenue_event": revenue_event,
            "diagnosis": diagnosis,
            "decision": decision,
            "action": action,
            "recovery_result": recovery_result,
            "audit_log": audit_log,
        }

    # ---------------------------------------------------------
    # CASE B — New webhook: event_id is not an existing revenue event
    # ---------------------------------------------------------

    # Store original webhook event (idempotent)
    webhook = persistence_service.create_webhook_event(
        event_id=event["event_id"],
        event_type=event["event_type"],
        payload=event,
    )

    # CASE C — Duplicate real webhook: webhook already has a revenue event
    existing_by_webhook = (
        persistence_service.get_revenue_event_by_webhook_id(
            webhook["id"]
        )
    )

    if existing_by_webhook:

        revenue_event_id = existing_by_webhook["id"]

        diagnosis = (
            persistence_service
            .get_diagnosis_by_revenue_event_id(revenue_event_id)
        )

        decision = (
            persistence_service
            .get_decision_by_revenue_event_id(revenue_event_id)
        )

        action = None
        recovery_result = None

        if decision:
            action = (
                persistence_service
                .get_action_by_decision_id(decision["id"])
            )

        if action:
            recovery_result = (
                persistence_service
                .get_recovery_result_by_action_id(action["id"])
            )

        return {
            "revenue_event": existing_by_webhook,
            "diagnosis": diagnosis,
            "decision": decision,
            "action": action,
            "recovery_result": recovery_result,
            "audit_log": None,
            "duplicate": True,
        }

    # ---------------------------------------------------------
    # New event — store customer, create revenue event, run workflow
    # ---------------------------------------------------------

    customer_record = persistence_service.get_or_create_customer(
        name=customer["name"],
        email=customer.get("email"),
        phone=customer.get("phone"),
    )

    revenue_event = persistence_service.create_revenue_event(
        customer_id=customer_record["id"],
        webhook_id=webhook["id"],
        event_type=event["event_type"],
        amount=event["amount"],
        risk_category="payment_failure",
        failure_code=event.get("failure_code"),
        mandate_status=event.get("mandate_status"),
        attempt_count=event.get("attempt_count", 0),
        days_overdue=event.get("days_overdue"),
        metadata={
            "previous_successful_payments": event.get(
                "previous_successful_payments"
            ),
            "days_since_last_payment": event.get(
                "days_since_last_payment"
            ),
        },
    )

    agent_result = _run_recovery_agent(event)

    diagnosis, decision, action, recovery_result, success = (
        _persist_workflow(revenue_event, event, agent_result)
    )

    revenue_status = _revenue_status_from_action(
        agent_result["action"], success
    )

    revenue_event = persistence_service.update_revenue_event_status(
        revenue_event_id=revenue_event["id"],
        status=revenue_status,
    )

    audit_log = persistence_service.create_audit_log(
        revenue_event_id=revenue_event["id"],
        action="recovery_workflow_completed",
        actor_type="recovery_agent",
        details={
            "diagnosis": agent_result["diagnosis"],
            "recovery_probability": agent_result[
                "recovery_probability"
            ],
            "recommended_action": agent_result["recommended_action"],
            "policy_allowed": agent_result["policy"]["allowed"],
            "policy_reason": agent_result["policy"]["reason"],
            "action_status": agent_result["action"]["status"],
            "amount_recovered": agent_result["action"][
                "amount_recovered"
            ],
        },
    )

    return {
        "revenue_event": revenue_event,
        "diagnosis": diagnosis,
        "decision": decision,
        "action": action,
        "recovery_result": recovery_result,
        "audit_log": audit_log,
    }
